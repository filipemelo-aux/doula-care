import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Baby, CheckCircle, AlertTriangle, Calendar, Clock, Activity, BookHeart, Timer } from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

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

interface Notification {
  id: string;
  type: "birth_approaching" | "post_term" | "payment_pending" | "labor_started" | "new_diary_entry" | "new_contraction";
  title: string;
  description: string;
  client?: Client & { current_weeks?: number | null; current_days?: number; is_post_term?: boolean };
  priority: "high" | "medium" | "low";
  icon: typeof Baby;
  color: string;
  timestamp?: string;
  extraInfo?: string;
}

export function NotificationsCenter() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
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

      // Return clients with 37+ weeks OR those in labor
      return enrichedClients
        .filter(client => 
          (client.current_weeks !== null && client.current_weeks >= 37) || 
          client.labor_started_at
        )
        .sort((a, b) => {
          // Labor started comes first
          if (a.labor_started_at && !b.labor_started_at) return -1;
          if (!a.labor_started_at && b.labor_started_at) return 1;
          // Then post-term
          if (a.is_post_term && !b.is_post_term) return -1;
          if (!a.is_post_term && b.is_post_term) return 1;
          // Then by weeks
          return (b.current_weeks || 0) - (a.current_weeks || 0);
        });
    },
  });

  // Fetch recent diary entries (last 24 hours)
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

      if (error) throw error;
      
      return data.map(entry => ({
        id: entry.id,
        client_id: entry.client_id,
        created_at: entry.created_at,
        client_name: (entry.clients as { full_name: string } | null)?.full_name || "Cliente"
      })) as DiaryEntry[];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch recent contractions (last 24 hours)
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

      if (error) throw error;
      
      return data.map(entry => ({
        id: entry.id,
        client_id: entry.client_id,
        started_at: entry.started_at,
        duration_seconds: entry.duration_seconds,
        client_name: (entry.clients as { full_name: string } | null)?.full_name || "Cliente"
      })) as ContractionEntry[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
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
          // Invalidate and refetch contractions when changes occur
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
          // Invalidate and refetch diary entries when new ones are added
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

  // Build notifications list
  const notifications: Notification[] = [];

  // Add labor started notifications (highest priority)
  birthAlertClients?.forEach(client => {
    if (client.labor_started_at) {
      notifications.push({
        id: `labor-${client.id}`,
        type: "labor_started",
        title: "Trabalho de Parto Iniciado",
        description: client.full_name,
        client,
        priority: "high",
        icon: Activity,
        color: "destructive",
        timestamp: client.labor_started_at
      });
    }
  });

  // Add birth approaching notifications
  birthAlertClients?.forEach(client => {
    if (client.is_post_term) {
      notifications.push({
        id: `post-term-${client.id}`,
        type: "post_term",
        title: "Gestação Pós-Data",
        description: client.full_name,
        client,
        priority: "high",
        icon: AlertTriangle,
        color: "destructive"
      });
    } else {
      notifications.push({
        id: `birth-${client.id}`,
        type: "birth_approaching",
        title: "Parto se Aproximando",
        description: client.full_name,
        client,
        priority: client.current_weeks && client.current_weeks >= 39 ? "high" : "medium",
        icon: Baby,
        color: client.current_weeks && client.current_weeks >= 39 ? "warning" : "warning"
      });
    }
  });

  // Add contraction notifications (medium priority - important for labor tracking)
  recentContractions?.forEach(entry => {
    const durationText = entry.duration_seconds 
      ? `${entry.duration_seconds}s de duração` 
      : "Em andamento";
    
    notifications.push({
      id: `contraction-${entry.id}`,
      type: "new_contraction",
      title: "Nova Contração Registrada",
      description: entry.client_name || "Cliente",
      priority: "medium",
      icon: Timer,
      color: "warning",
      timestamp: entry.started_at,
      extraInfo: durationText
    });
  });

  // Add diary entry notifications
  recentDiaryEntries?.forEach(entry => {
    notifications.push({
      id: `diary-${entry.id}`,
      type: "new_diary_entry",
      title: "Novo Registro no Diário",
      description: entry.client_name || "Cliente",
      priority: "low",
      icon: BookHeart,
      color: "primary",
      timestamp: entry.created_at
    });
  });

  // Sort by priority and type (labor_started first, then by timestamp)
  notifications.sort((a, b) => {
    // Labor started always comes first
    if (a.type === "labor_started" && b.type !== "labor_started") return -1;
    if (a.type !== "labor_started" && b.type === "labor_started") return 1;
    
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // Within same priority, sort by timestamp (newest first)
    if (a.timestamp && b.timestamp) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    
    return 0;
  });

  const isLoading = loadingBirth || loadingDiary || loadingContractions;
  const hasNotifications = notifications.length > 0;
  const highPriorityCount = notifications.filter(n => n.priority === "high").length;

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
                {notifications.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Tudo em dia!</p>
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[300px] lg:max-h-[400px] px-4 pb-4">
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      notification.priority === "high"
                        ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                        : notification.priority === "medium"
                        ? "bg-warning/5 border-warning/20 hover:bg-warning/10"
                        : "bg-muted/30 border-border/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.priority === "high"
                          ? "bg-destructive/15"
                          : notification.type === "new_contraction"
                          ? "bg-orange-500/15"
                          : notification.priority === "medium"
                          ? "bg-warning/15"
                          : notification.type === "new_diary_entry"
                          ? "bg-primary/15"
                          : "bg-muted"
                      }`}>
                        <notification.icon className={`h-4 w-4 ${
                          notification.priority === "high"
                            ? "text-destructive"
                            : notification.type === "new_contraction"
                            ? "text-orange-500"
                            : notification.priority === "medium"
                            ? "text-warning"
                            : notification.type === "new_diary_entry"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium ${
                            notification.priority === "high"
                              ? "text-destructive"
                              : notification.type === "new_contraction"
                              ? "text-orange-500"
                              : notification.priority === "medium"
                              ? "text-warning"
                              : notification.type === "new_diary_entry"
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}>
                            {notification.title}
                          </span>
                          {notification.client && notification.type !== "labor_started" && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 h-4 border-0 ${
                                notification.client.is_post_term
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-warning/20 text-warning"
                              }`}
                            >
                              {notification.client.current_weeks}s{notification.client.current_days && notification.client.current_days > 0 ? `${notification.client.current_days}d` : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">
                          {notification.description}
                        </p>
                        {notification.type === "labor_started" && notification.timestamp && (
                          <p className="text-xs text-destructive mt-0.5 flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3" />
                            Início: {format(parseISO(notification.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        {notification.client?.dpp && notification.type !== "labor_started" && notification.type !== "new_diary_entry" && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            DPP: {format(parseISO(notification.client.dpp), "dd/MM/yyyy")}
                          </p>
                        )}
                        {notification.type === "new_diary_entry" && notification.timestamp && (
                          <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(notification.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        {notification.type === "new_contraction" && notification.timestamp && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-orange-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(notification.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            {notification.extraInfo && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-orange-300 text-orange-600 bg-orange-50">
                                {notification.extraInfo}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {notification.client && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs hover:bg-primary/10 flex-shrink-0"
                          onClick={() => handleRegisterBirth(notification.client as Client)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Nasceu
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <BirthRegistrationDialog
        open={birthDialogOpen}
        onOpenChange={setBirthDialogOpen}
        client={selectedClient}
      />
    </>
  );
}
