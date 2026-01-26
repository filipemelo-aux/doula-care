import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bell, Baby, CheckCircle, AlertTriangle, Calendar, Clock, Activity, BookHeart, Timer, ChevronDown, ChevronRight } from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { ClientDiaryDialog } from "@/components/dashboard/ClientDiaryDialog";
import { ClientContractionsDialog } from "@/components/dashboard/ClientContractionsDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface EnrichedClient extends Client {
  current_weeks: number | null;
  current_days: number;
  is_post_term: boolean;
}

interface DiaryEntry {
  id: string;
  client_id: string;
  created_at: string;
  client_name?: string;
}

interface ContractionEntry {
  id: string;
  client_id: string;
  started_at: string;
  duration_seconds: number | null;
  client_name?: string;
}

interface ChildNotification {
  id: string;
  type: "labor_started" | "new_contraction" | "new_diary_entry";
  title: string;
  description: string;
  timestamp?: string;
  extraInfo?: string;
  priority: "high" | "medium" | "low";
  clientId?: string;
}

interface ParentNotification {
  id: string;
  type: "birth_approaching" | "post_term" | "new_diary_entry";
  title: string;
  description: string;
  client?: EnrichedClient;
  priority: "high" | "medium" | "low";
  icon: typeof Baby;
  timestamp?: string;
  children: ChildNotification[];
  isInLabor?: boolean;
  clientId?: string;
}

export function NotificationsCenter() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [diaryClient, setDiaryClient] = useState<Client | null>(null);
  const [contractionsDialogOpen, setContractionsDialogOpen] = useState(false);
  const [contractionsClient, setContractionsClient] = useState<Client | null>(null);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: birthAlertClients, isLoading: loadingBirth } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .order("pregnancy_weeks", { ascending: false });

      if (error) throw error;
      
      const enrichedClients = data.map(client => ({
        ...client,
        current_weeks: calculateCurrentPregnancyWeeks(
          client.pregnancy_weeks,
          client.pregnancy_weeks_set_at,
          client.dpp
        ),
        current_days: calculateCurrentPregnancyDays(client.dpp),
        is_post_term: isPostTerm(client.dpp)
      }));

      return enrichedClients
        .filter(client => 
          (client.current_weeks !== null && client.current_weeks >= 37) || 
          client.labor_started_at
        )
        .sort((a, b) => {
          if (a.labor_started_at && !b.labor_started_at) return -1;
          if (!a.labor_started_at && b.labor_started_at) return 1;
          if (a.is_post_term && !b.is_post_term) return -1;
          if (!a.is_post_term && b.is_post_term) return 1;
          return (b.current_weeks || 0) - (a.current_weeks || 0);
        });
    },
  });

  const { data: recentDiaryEntries, isLoading: loadingDiary } = useQuery({
    queryKey: ["recent-diary-entries"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from("pregnancy_diary")
        .select("id, client_id, created_at, read_by_admin, clients(full_name)")
        .eq("read_by_admin", false)
        .gte("created_at", twentyFourHoursAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching diary entries:", error);
        throw error;
      }
      
      return data.map(entry => ({
        id: entry.id,
        client_id: entry.client_id,
        created_at: entry.created_at,
        client_name: (entry.clients as { full_name: string } | null)?.full_name || "Cliente"
      })) as DiaryEntry[];
    },
    refetchInterval: 60000,
  });

  const { data: recentContractions, isLoading: loadingContractions } = useQuery({
    queryKey: ["recent-contractions"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from("contractions")
        .select("id, client_id, started_at, duration_seconds, clients(full_name)")
        .gte("started_at", twentyFourHoursAgo.toISOString())
        .order("started_at", { ascending: false });

      if (error) {
        console.error("Error fetching contractions:", error);
        throw error;
      }
      
      return data.map(entry => ({
        id: entry.id,
        client_id: entry.client_id,
        started_at: entry.started_at,
        duration_seconds: entry.duration_seconds,
        client_name: (entry.clients as { full_name: string } | null)?.full_name || "Cliente"
      })) as ContractionEntry[];
    },
    refetchInterval: 30000,
  });

  // Real-time subscription for contractions
  useEffect(() => {
    const channel = supabase
      .channel('contractions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contractions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Real-time subscription for diary entries
  useEffect(() => {
    const channel = supabase
      .channel('diary-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pregnancy_diary'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["recent-diary-entries"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleRegisterBirth = (client: Client) => {
    setSelectedClient(client);
    setBirthDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedNotifications(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Group contractions by client
  const contractionsByClient = new Map<string, { entries: ContractionEntry[]; clientName: string }>();
  recentContractions?.forEach(entry => {
    const existing = contractionsByClient.get(entry.client_id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      contractionsByClient.set(entry.client_id, {
        entries: [entry],
        clientName: entry.client_name || "Cliente"
      });
    }
  });

  // Group diary entries by client
  const diaryByClient = new Map<string, { entries: DiaryEntry[]; clientName: string }>();
  recentDiaryEntries?.forEach(entry => {
    const existing = diaryByClient.get(entry.client_id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      diaryByClient.set(entry.client_id, {
        entries: [entry],
        clientName: entry.client_name || "Cliente"
      });
    }
  });

  // Build parent notifications with children
  const parentNotifications: ParentNotification[] = [];

  // Track which clients have birth alerts
  const clientsWithBirthAlert = new Set<string>();
  birthAlertClients?.forEach(client => clientsWithBirthAlert.add(client.id));

  // Parent: Birth approaching/Post-term with children (labor, contractions, diary)
  birthAlertClients?.forEach(client => {
    const children: ChildNotification[] = [];
    
    // Child: Labor started
    if (client.labor_started_at) {
      children.push({
        id: `labor-${client.id}`,
        type: "labor_started",
        title: "Trabalho de Parto Iniciado",
        description: "Alerta de alta prioridade",
        timestamp: client.labor_started_at,
        priority: "high"
      });
    }

    // Child: Contractions - check if intervals are less than 2 minutes
    const clientContractions = contractionsByClient.get(client.id);
    if (clientContractions) {
      const count = clientContractions.entries.length;
      const latestEntry = clientContractions.entries[0];
      const durationText = latestEntry.duration_seconds 
        ? `${latestEntry.duration_seconds}s` 
        : "Em andamento";

      // Calculate if last intervals are less than 2 minutes (urgent)
      let isUrgentContractions = false;
      if (count >= 2) {
        const sortedEntries = [...clientContractions.entries].sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        // Check last 2 intervals
        const intervals: number[] = [];
        for (let i = 0; i < Math.min(sortedEntries.length - 1, 2); i++) {
          const interval = (new Date(sortedEntries[i].started_at).getTime() - 
                           new Date(sortedEntries[i + 1].started_at).getTime()) / 1000 / 60;
          intervals.push(interval);
        }
        // If all recent intervals are less than 2 minutes, it's urgent
        isUrgentContractions = intervals.length > 0 && intervals.every(interval => interval < 2);
      }

      children.push({
        id: `contraction-${client.id}`,
        type: "new_contraction",
        title: isUrgentContractions ? "Contrações Urgentes" : count >= 3 ? "Contrações Frequentes" : "Nova Contração",
        description: count > 1 ? `${count} contrações nas últimas 24h` : "1 contração registrada",
        timestamp: latestEntry.started_at,
        extraInfo: durationText,
        priority: isUrgentContractions ? "high" : "medium"
      });

      // Remove from map so we don't duplicate
      contractionsByClient.delete(client.id);
    }

    // Child: Diary entries (add as child when client has birth alert) - always medium priority
    const clientDiary = diaryByClient.get(client.id);
    if (clientDiary) {
      const count = clientDiary.entries.length;
      const latestEntry = clientDiary.entries[0];

      children.push({
        id: `diary-child-${client.id}`,
        type: "new_diary_entry",
        title: count > 1 ? `${count} Registros no Diário` : "Registro no Diário",
        description: "Novo registro disponível",
        timestamp: latestEntry.created_at,
        priority: "low",
        clientId: client.id
      });

      // Remove from map so we don't duplicate as parent
      diaryByClient.delete(client.id);
    }

    // Sort children by timestamp descending (most recent first)
    children.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Determine parent type
    const parentType = client.is_post_term ? "post_term" : "birth_approaching";
    const hasHighPriorityChild = children.some(c => c.priority === "high");
    const isInLabor = !!client.labor_started_at;
    
    parentNotifications.push({
      id: `birth-${client.id}`,
      type: parentType,
      title: client.is_post_term ? "Gestação Pós-Data" : "Parto se Aproximando",
      description: client.full_name,
      client,
      priority: hasHighPriorityChild || client.is_post_term || (client.current_weeks && client.current_weeks >= 39) ? "high" : "medium",
      icon: client.is_post_term ? AlertTriangle : Baby,
      children,
      isInLabor
    });
  });

  // Parent: New diary entries (standalone - only for clients WITHOUT birth alert)
  diaryByClient.forEach(({ entries, clientName }, clientId) => {
    const latestEntry = entries[0];
    const count = entries.length;
    
    parentNotifications.push({
      id: `diary-${clientId}`,
      type: "new_diary_entry",
      title: count > 1 ? `${count} Novos Registros no Diário` : "Novo Registro no Diário",
      description: clientName,
      priority: "low",
      icon: BookHeart,
      timestamp: latestEntry.created_at,
      children: [],
      clientId
    });
  });

  // Handle orphan contractions (clients not in 37+ weeks alert)
  contractionsByClient.forEach(({ entries, clientName }, clientId) => {
    const count = entries.length;
    const latestEntry = entries[0];
    const isActiveLabor = count >= 3;
    const durationText = latestEntry.duration_seconds 
      ? `${latestEntry.duration_seconds}s` 
      : "Em andamento";

    // Create as parent since client isn't in birth alert
    parentNotifications.push({
      id: `contraction-orphan-${clientId}`,
      type: "birth_approaching",
      title: "Atividade de Contração",
      description: clientName,
      priority: isActiveLabor ? "high" : "medium",
      icon: Timer,
      timestamp: latestEntry.started_at,
      children: [{
        id: `contraction-${clientId}`,
        type: "new_contraction",
        title: isActiveLabor ? "Contrações Frequentes" : "Nova Contração",
        description: count > 1 ? `${count} contrações nas últimas 24h` : "1 contração registrada",
        timestamp: latestEntry.started_at,
        extraInfo: durationText,
        priority: isActiveLabor ? "high" : "medium"
      }]
    });
  });

  // Sort by priority (high priority children count too)
  parentNotifications.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aHasHighChild = a.children.some(c => c.priority === "high");
    const bHasHighChild = b.children.some(c => c.priority === "high");
    
    // High priority parents or parents with high priority children first
    const aEffectivePriority = a.priority === "high" || aHasHighChild ? "high" : a.priority;
    const bEffectivePriority = b.priority === "high" || bHasHighChild ? "high" : b.priority;
    
    const priorityDiff = priorityOrder[aEffectivePriority] - priorityOrder[bEffectivePriority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by timestamp
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  const isLoading = loadingBirth || loadingDiary || loadingContractions;
  const hasNotifications = parentNotifications.length > 0;
  const highPriorityCount = parentNotifications.filter(n => 
    n.priority === "high" || n.children.some(c => c.priority === "high")
  ).length;

  // Auto-expand notifications with high priority children
  useEffect(() => {
    const toExpand = new Set<string>();
    parentNotifications.forEach(n => {
      if (n.children.some(c => c.priority === "high")) {
        toExpand.add(n.id);
      }
    });
    if (toExpand.size > 0) {
      setExpandedNotifications(prev => new Set([...prev, ...toExpand]));
    }
  }, [parentNotifications.length]);

  if (isLoading) {
    return (
      <Card className="card-glass h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Notificações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-glass h-full flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {highPriorityCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <CardTitle className="text-base font-semibold">Notificações</CardTitle>
            </div>
            {hasNotifications && (
              <Badge variant="secondary" className="text-xs">
                {parentNotifications.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Tudo em dia!</p>
            </div>
          ) : (
            <div className="max-h-[300px] lg:max-h-[400px] overflow-y-auto overflow-x-hidden px-2 lg:px-4 pb-3 lg:pb-4">
              <div className="space-y-2 pt-1 lg:pt-2">
                {parentNotifications.map((notification) => {
                  const hasChildren = notification.children.length > 0;
                  const isExpanded = expandedNotifications.has(notification.id);
                  // Only post-term gets high priority styling
                  const isPostTerm = notification.type === "post_term";

                  return (
                    <Collapsible
                      key={notification.id}
                      open={isExpanded}
                      onOpenChange={() => hasChildren && toggleExpanded(notification.id)}
                    >
                      <div
                        className={`rounded-lg border transition-colors ${
                          notification.isInLabor
                            ? "bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20"
                            : isPostTerm
                            ? "bg-destructive/5 border-destructive/20"
                            : notification.type === "new_diary_entry"
                            ? "bg-primary/5 border-primary/20"
                            : "bg-warning/5 border-warning/20"
                        }`}
                      >
                        {/* Parent notification */}
                        <CollapsibleTrigger asChild disabled={!hasChildren}>
                          <div className={`p-2 lg:p-3 ${hasChildren ? "cursor-pointer hover:bg-black/5" : ""}`}>
                            <div className="flex items-start gap-2">
                              <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isPostTerm
                                  ? "bg-destructive/15"
                                  : notification.type === "new_diary_entry"
                                  ? "bg-primary/15"
                                  : "bg-warning/15"
                              }`}>
                                <notification.icon className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${
                                  isPostTerm
                                    ? "text-destructive"
                                    : notification.type === "new_diary_entry"
                                    ? "text-primary"
                                    : "text-warning"
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center flex-wrap gap-1 mb-0.5">
                                  <span className={`text-[11px] lg:text-xs font-medium ${
                                    isPostTerm
                                      ? "text-destructive"
                                      : notification.type === "new_diary_entry"
                                      ? "text-primary"
                                      : "text-warning"
                                  }`}>
                                    {notification.title}
                                  </span>
                                  {notification.client && (
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[9px] lg:text-[10px] px-1 lg:px-1.5 h-4 border-0 ${
                                        notification.client.is_post_term
                                          ? "bg-destructive/20 text-destructive"
                                          : "bg-warning/20 text-warning"
                                      }`}
                                    >
                                      {notification.client.current_weeks}s{notification.client.current_days > 0 ? `${notification.client.current_days}d` : ""}
                                    </Badge>
                                  )}
                                  {hasChildren && (
                                    <Badge variant="secondary" className="text-[9px] lg:text-[10px] px-1 lg:px-1.5 h-4">
                                      {notification.children.length}
                                    </Badge>
                                  )}
                                  {hasChildren && (
                                    isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto flex-shrink-0" />
                                    )
                                  )}
                                </div>
                                <p className="text-xs lg:text-sm font-medium text-foreground truncate">
                                  {notification.description}
                                </p>
                                {/* Labor badge - pulsing */}
                                {notification.isInLabor && (
                                  <Badge className="bg-destructive text-destructive-foreground text-[9px] lg:text-[10px] px-1.5 h-4 lg:h-5 mt-1 animate-pulse">
                                    🚨 EM TRABALHO DE PARTO
                                  </Badge>
                                )}
                                {notification.client?.dpp && notification.type !== "new_diary_entry" && (
                                  <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Calendar className="h-2.5 w-2.5 lg:h-3 lg:w-3 flex-shrink-0" />
                                    DPP: {format(parseISO(notification.client.dpp), "dd/MM/yyyy")}
                                  </p>
                                )}
                                {notification.type === "new_diary_entry" && notification.timestamp && (
                                  <p className="text-[10px] lg:text-xs text-primary mt-0.5 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 flex-shrink-0" />
                                    {format(parseISO(notification.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                                {/* Button on mobile - below content */}
                                {notification.client && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px] lg:text-xs border-dashed hover:bg-primary/10 mt-1.5 w-full lg:hidden"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRegisterBirth(notification.client as Client);
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                    Registrar nascimento
                                  </Button>
                                )}
                              </div>
                              {/* Button on desktop - right side */}
                              {notification.client && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-dashed hover:bg-primary/10 hidden lg:flex flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegisterBirth(notification.client as Client);
                                  }}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Registrar nascimento
                                </Button>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Child notifications */}
                        <CollapsibleContent>
                          <div className="border-t border-border/50 mx-1 lg:mx-3 mb-1.5 lg:mb-3 pt-1.5 lg:pt-2 space-y-1 lg:space-y-2 overflow-hidden">
                            {notification.children.map((child) => (
                              <div
                                key={child.id}
                                onClick={() => {
                                  if (child.type === "new_diary_entry" && notification.client) {
                                    setDiaryClient(notification.client);
                                    setDiaryDialogOpen(true);
                                  } else if (child.type === "new_contraction" && notification.client) {
                                    setContractionsClient(notification.client);
                                    setContractionsDialogOpen(true);
                                  }
                                }}
                                className={`p-1 lg:p-1.5 rounded-md ml-1 lg:ml-4 border-l-2 ${
                                  child.type === "labor_started"
                                    ? "bg-destructive/10 border-l-destructive"
                                    : child.type === "new_contraction" && child.priority === "high"
                                    ? "bg-destructive/10 border-l-destructive"
                                    : child.type === "new_contraction"
                                    ? "bg-orange-500/10 border-l-orange-500"
                                    : "bg-emerald-500/10 border-l-emerald-500"
                                } ${child.type === "new_diary_entry" ? "cursor-pointer hover:bg-emerald-500/20 transition-colors" : ""} ${child.type === "new_contraction" ? "cursor-pointer hover:bg-orange-500/20 transition-colors" : ""}`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    child.type === "labor_started"
                                      ? "bg-destructive/20"
                                      : child.type === "new_contraction" && child.priority === "high"
                                      ? "bg-destructive/20"
                                      : child.type === "new_contraction"
                                      ? "bg-orange-500/20"
                                      : "bg-emerald-500/20"
                                  }`}>
                                    {child.type === "labor_started" ? (
                                      <Activity className="h-2.5 w-2.5 text-destructive" />
                                    ) : child.type === "new_diary_entry" ? (
                                      <BookHeart className="h-2.5 w-2.5 text-emerald-600" />
                                    ) : (
                                      <Timer className={`h-2.5 w-2.5 ${
                                        child.priority === "high" ? "text-destructive" : "text-orange-500"
                                      }`} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-[10px] font-medium block truncate ${
                                      child.type === "labor_started"
                                        ? "text-destructive" 
                                        : child.type === "new_contraction" && child.priority === "high"
                                        ? "text-destructive"
                                        : child.type === "new_contraction"
                                        ? "text-orange-600"
                                        : "text-emerald-700"
                                    }`}>
                                      {child.title}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {child.description}
                                    </p>
                                    {child.timestamp && (
                                      <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                                        child.type === "labor_started"
                                          ? "text-destructive" 
                                          : child.type === "new_contraction" && child.priority === "high"
                                          ? "text-destructive"
                                          : child.type === "new_contraction"
                                          ? "text-orange-500"
                                          : "text-emerald-600"
                                      }`}>
                                        <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                                        <span className="truncate">{format(parseISO(child.timestamp), "dd/MM HH:mm", { locale: ptBR })}</span>
                                        {child.extraInfo && (
                                          <Badge 
                                            variant="outline" 
                                            className={`text-[9px] h-3.5 px-1 flex-shrink-0 ${
                                              child.priority === "high" 
                                                ? "border-destructive/50 text-destructive bg-destructive/10"
                                                : child.type === "new_contraction"
                                                ? "border-orange-300 text-orange-600 bg-orange-50"
                                                : "border-emerald-300 text-emerald-600 bg-emerald-50"
                                            }`}
                                          >
                                            {child.extraInfo}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BirthRegistrationDialog
        open={birthDialogOpen}
        onOpenChange={setBirthDialogOpen}
        client={selectedClient}
      />

      <ClientDiaryDialog
        open={diaryDialogOpen}
        onOpenChange={setDiaryDialogOpen}
        client={diaryClient}
      />

      <ClientContractionsDialog
        open={contractionsDialogOpen}
        onOpenChange={setContractionsDialogOpen}
        client={contractionsClient}
      />
    </>
  );
}
