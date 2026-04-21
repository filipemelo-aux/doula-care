import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Baby, CheckCircle, AlertTriangle, Calendar, Clock, Activity, BookHeart, Timer, Sparkles, Send, History, CalendarCheck, Pause } from "lucide-react";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { fetchBirthAlertClients, type BirthAlertClient } from "@/lib/birthAlerts";
import { ClientDiaryDialog } from "@/components/dashboard/ClientDiaryDialog";
import { ClientContractionsDialog } from "@/components/dashboard/ClientContractionsDialog";
import { SendBudgetDialog } from "@/components/dashboard/SendBudgetDialog";
import { formatBrazilDate, formatBrazilDateTime, abbreviateName, cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Client = Tables<"clients">;

interface FlatNotification {
  id: string;
  type: "labor" | "post_term" | "birth_approaching" | "contraction" | "diary" | "service_request" | "appointment_request";
  title: string;
  subtitle: string;
  detail?: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
  clientId?: string;
  client?: Client;
  requestId?: string;
  isRead?: boolean;
  weeksBadge?: string;
}

interface NotificationsCenterProps {
  fullPage?: boolean;
}

export function NotificationsCenter({ fullPage = false }: NotificationsCenterProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [diaryClient, setDiaryClient] = useState<Client | null>(null);
  const [contractionsDialogOpen, setContractionsDialogOpen] = useState(false);
  const [contractionsClient, setContractionsClient] = useState<Client | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<{
    id: string; client_id: string; service_type: string; client_name: string; preferred_date?: string | null;
  } | null>(null);
  const queryClient = useQueryClient();

  // Last seen timestamp for birth alerts (set when user opens notifications page)
  const { data: birthAlertLastSeen } = useQuery({
    queryKey: ["birth-alert-last-seen-center"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return null;
      const { data } = await supabase
        .from("notification_seen")
        .select("seen_at")
        .eq("user_id", userData.user.id)
        .eq("storage_key", "birth-alert-seen")
        .eq("section", "last_viewed")
        .maybeSingle();
      return data?.seen_at ?? null;
    },
    staleTime: 10000,
  });

  const { data: allClients } = useQuery({
    queryKey: ["all-clients-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("full_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const clientsMap = new Map<string, Client>();
  allClients?.forEach(c => clientsMap.set(c.id, c));

  const { data: birthAlertClients, isLoading: loadingBirth } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: fetchBirthAlertClients,
    refetchInterval: 30000,
  });

  const { data: recentDiaryEntries, isLoading: loadingDiary } = useQuery({
    queryKey: ["recent-diary-entries"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      const { data, error } = await supabase.from("pregnancy_diary")
        .select("id, client_id, created_at, read_by_admin, clients(full_name)")
        .gte("created_at", cutoff.toISOString()).order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(e => ({
        id: e.id, client_id: e.client_id, created_at: e.created_at,
        read_by_admin: e.read_by_admin ?? false,
        client_name: (e.clients as any)?.full_name || "Cliente"
      }));
    },
    refetchInterval: 60000,
  });

  const { data: recentContractions, isLoading: loadingContractions } = useQuery({
    queryKey: ["recent-contractions"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      const { data, error } = await supabase.from("contractions")
        .select("id, client_id, started_at, duration_seconds, read_by_admin, clients!inner(full_name, status, birth_occurred)")
        .gte("started_at", cutoff.toISOString())
        .eq("clients.status", "gestante").eq("clients.birth_occurred", false)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data.map(e => ({
        id: e.id, client_id: e.client_id, started_at: e.started_at,
        duration_seconds: e.duration_seconds, read_by_admin: (e as any).read_by_admin ?? false,
        client_name: (e.clients as any)?.full_name || "Cliente"
      }));
    },
    refetchInterval: 30000,
  });

  const { data: serviceRequests, isLoading: loadingSvc } = useQuery({
    queryKey: ["service-requests-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_requests")
        .select("id, client_id, service_type, status, created_at, preferred_date, clients(full_name)")
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(e => ({
        id: e.id, client_id: e.client_id, service_type: e.service_type,
        status: e.status, created_at: e.created_at, preferred_date: e.preferred_date,
        client_name: (e.clients as any)?.full_name || "Cliente"
      }));
    },
    refetchInterval: 30000,
  });

  const { data: appointmentRequests, isLoading: loadingApt } = useQuery({
    queryKey: ["appointment-requests-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointment_requests")
        .select("id, client_id, requested_date, requested_time, reason, status, created_at, clients(full_name)")
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(e => ({
        id: e.id, client_id: e.client_id, requested_date: e.requested_date,
        requested_time: e.requested_time, reason: e.reason,
        status: e.status, created_at: e.created_at,
        client_name: (e.clients as any)?.full_name || "Cliente"
      }));
    },
    refetchInterval: 30000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('notifications-center-rt')
      .on("postgres_changes", { event: "*", schema: "public", table: "contractions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pregnancy_diary" }, () => {
        queryClient.invalidateQueries({ queryKey: ["recent-diary-entries"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["service-requests-pending"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointment-requests-pending"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
        queryClient.invalidateQueries({ queryKey: ["all-clients-lookup"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Build flat notification list
  const notifications: FlatNotification[] = [];

  // 1. Labor / Birth alerts (marked as read once user has visited the notifications page)
  const isBirthRead = (ts: string) => {
    if (!birthAlertLastSeen) return false;
    return new Date(ts).getTime() <= new Date(birthAlertLastSeen).getTime();
  };
  birthAlertClients?.forEach(client => {
    const weekStr = `${client.current_weeks}s${client.current_days > 0 ? `${client.current_days}d` : ""}`;
    if (client.labor_started_at) {
      notifications.push({
        id: `labor-${client.id}`, type: "labor",
        title: "🚨 Em Trabalho de Parto",
        subtitle: client.full_name,
        detail: `Iniciado ${formatBrazilDateTime(client.labor_started_at, "dd/MM 'às' HH:mm")}`,
        timestamp: client.labor_started_at, priority: "high",
        clientId: client.id, client: client as Client, weeksBadge: weekStr,
        isRead: isBirthRead(client.labor_started_at),
      });
    } else if (client.is_post_term) {
      const ts = client.dpp || client.created_at;
      notifications.push({
        id: `postterm-${client.id}`, type: "post_term",
        title: "⚠️ Gestação Pós-Data",
        subtitle: client.full_name,
        detail: client.dpp ? `DPP: ${formatBrazilDate(client.dpp)}` : undefined,
        timestamp: ts, priority: "high",
        clientId: client.id, client: client as Client, weeksBadge: weekStr,
        isRead: isBirthRead(ts),
      });
    } else {
      const ts = client.dpp || client.created_at;
      notifications.push({
        id: `approaching-${client.id}`, type: "birth_approaching",
        title: "Parto se Aproximando",
        subtitle: client.full_name,
        detail: client.dpp ? `DPP: ${formatBrazilDate(client.dpp)}` : undefined,
        timestamp: ts, priority: "medium",
        clientId: client.id, client: client as Client, weeksBadge: weekStr,
        isRead: isBirthRead(ts),
      });
    }
  });

  // 2. Contractions (grouped by client)
  const contractionsByClient = new Map<string, { count: number; latest: any; clientName: string; allRead: boolean }>();
  recentContractions?.forEach(e => {
    const existing = contractionsByClient.get(e.client_id);
    if (existing) { existing.count++; if (!e.read_by_admin) existing.allRead = false; }
    else contractionsByClient.set(e.client_id, { count: 1, latest: e, clientName: e.client_name, allRead: e.read_by_admin });
  });
  contractionsByClient.forEach(({ count, latest, clientName, allRead }, clientId) => {
    // Skip if client already has labor notification
    if (notifications.some(n => n.type === "labor" && n.clientId === clientId)) return;
    const dur = latest.duration_seconds ? `${latest.duration_seconds}s` : "Em andamento";
    notifications.push({
      id: `contraction-${clientId}`, type: "contraction",
      title: count >= 3 ? "⚠️ Contrações Frequentes" : "Contração Registrada",
      subtitle: clientName,
      detail: `Duração: ${dur} • ${count} nas últimas 24h`,
      timestamp: latest.started_at, priority: count >= 3 ? "high" : "medium",
      clientId, isRead: allRead,
    });
  });

  // 3. Diary entries (grouped by client)
  const diaryByClient = new Map<string, { count: number; unread: number; latest: any; clientName: string; allRead: boolean }>();
  recentDiaryEntries?.forEach(e => {
    const existing = diaryByClient.get(e.client_id);
    if (existing) { existing.count++; if (!e.read_by_admin) { existing.unread++; existing.allRead = false; } }
    else diaryByClient.set(e.client_id, { count: 1, unread: e.read_by_admin ? 0 : 1, latest: e, clientName: e.client_name, allRead: e.read_by_admin });
  });
  diaryByClient.forEach(({ count, unread, latest, clientName, allRead }, clientId) => {
    if (!fullPage && allRead) return;
    notifications.push({
      id: `diary-${clientId}`, type: "diary",
      title: count > 1 ? `${count} Registros no Diário` : "Registro no Diário",
      subtitle: clientName,
      detail: unread > 0 ? `${unread} não lido(s)` : "Já visualizado",
      timestamp: latest.created_at, priority: "low",
      clientId, isRead: allRead,
    });
  });

  // 4. Service requests
  serviceRequests?.forEach(req => {
    notifications.push({
      id: `svc-${req.id}`, type: "service_request",
      title: "Solicitação de Serviço",
      subtitle: req.client_name,
      detail: req.service_type,
      timestamp: req.created_at, priority: "medium",
      clientId: req.client_id, requestId: req.id,
    });
  });

  // 5. Appointment requests
  appointmentRequests?.forEach(req => {
    const dateStr = formatBrazilDate(req.requested_date, "dd/MM");
    const timeStr = req.requested_time?.slice(0, 5) || "";
    notifications.push({
      id: `apt-${req.id}`, type: "appointment_request",
      title: "Solicitação de Consulta",
      subtitle: req.client_name,
      detail: `${dateStr} às ${timeStr}${req.reason ? ` — ${req.reason}` : ""}`,
      timestamp: req.created_at, priority: "medium",
      clientId: req.client_id, requestId: req.id,
    });
  });

  // Sort
  notifications.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    const pd = p[a.priority] - p[b.priority];
    if (pd !== 0) return pd;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const isLoading = loadingBirth || loadingDiary || loadingContractions || loadingSvc || loadingApt;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Handlers
  const handleRegisterBirth = (client: Client) => { setSelectedClient(client); setBirthDialogOpen(true); };

  const handleStartLabor = async (clientId: string) => {
    const client = clientsMap.get(clientId);
    if (!client) return;
    const { error } = await supabase.from("clients").update({ labor_started_at: new Date().toISOString() }).eq("id", clientId);
    if (error) { toast.error("Erro ao registrar trabalho de parto"); return; }
    toast.success(`Trabalho de parto registrado para ${client.full_name}`);
    queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
    queryClient.invalidateQueries({ queryKey: ["all-clients-lookup"] });
  };

  const handleMarkContractionRead = async (clientId: string) => {
    await supabase.from("contractions").update({ read_by_admin: true } as any).eq("client_id", clientId).eq("read_by_admin", false);
    queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
  };

  const handleOpenBudgetDialog = (requestId: string) => {
    const req = serviceRequests?.find(r => r.id === requestId);
    if (!req) return;
    setSelectedServiceRequest({
      id: req.id, client_id: req.client_id, service_type: req.service_type,
      client_name: req.client_name || "Cliente", preferred_date: req.preferred_date || null,
    });
    setBudgetDialogOpen(true);
  };

  // Style configs
  const styleMap = {
    labor: { bg: "bg-destructive/10 ring-1 ring-destructive/30", icon: Activity, iconColor: "text-destructive", titleColor: "text-destructive" },
    post_term: { bg: "bg-destructive/8 ring-1 ring-destructive/20", icon: AlertTriangle, iconColor: "text-destructive", titleColor: "text-destructive" },
    birth_approaching: { bg: "bg-warning/8", icon: Baby, iconColor: "text-warning", titleColor: "text-warning" },
    contraction: { bg: "bg-orange-500/8", icon: Timer, iconColor: "text-orange-500", titleColor: "text-orange-600" },
    diary: { bg: "bg-emerald-500/8", icon: BookHeart, iconColor: "text-emerald-600", titleColor: "text-emerald-700" },
    service_request: { bg: "bg-purple-500/8", icon: Sparkles, iconColor: "text-purple-600", titleColor: "text-purple-700" },
    appointment_request: { bg: "bg-blue-500/8", icon: CalendarCheck, iconColor: "text-blue-600", titleColor: "text-blue-700" },
  };

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
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-glass h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-2 lg:pb-3 px-3 lg:px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />}
              </div>
              <CardTitle className="text-base font-semibold">Notificações</CardTitle>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-hidden">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tudo em dia! 🎉</p>
            </div>
          ) : (
            <div className={cn(
              "overflow-y-auto overflow-x-hidden px-2 lg:px-4 pb-3 lg:pb-4",
              fullPage ? "max-h-[calc(100vh-14rem)]" : "max-h-[400px] lg:max-h-[500px]"
            )}>
              <div className="space-y-2 pt-1">
                {notifications.map((n) => {
                  const style = styleMap[n.type];
                  const Icon = style.icon;
                  const isLabor = n.type === "labor";

                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-xl p-3 lg:p-4 transition-all",
                        style.bg,
                        n.isRead && "opacity-50",
                        isLabor && "animate-pulse"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          isLabor ? "bg-destructive/20" : "bg-background/80"
                        )}>
                          <Icon className={cn("h-4 w-4", style.iconColor)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-xs font-semibold", style.titleColor)}>{n.title}</span>
                            {n.weeksBadge && (
                              <Badge variant="outline" className={cn(
                                "text-[10px] px-1.5 h-4 border-0",
                                n.type === "labor" || n.type === "post_term" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                              )}>
                                {n.weeksBadge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground mt-0.5 truncate">{n.subtitle}</p>
                          {n.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5">{n.detail}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatBrazilDateTime(n.timestamp, "dd/MM 'às' HH:mm")}
                          </p>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {/* Birth alerts: only labor shows actions (Ver Contrações + Registrar Nascimento) */}
                            {n.type === "labor" && n.client && n.clientId && (
                              <>
                                <Button size="sm" variant="outline"
                                  className="h-7 px-2.5 text-[11px] border-dashed border-orange-300 hover:bg-orange-500/10"
                                  onClick={() => {
                                    const c = clientsMap.get(n.clientId!) ?? n.client!;
                                    setContractionsClient(c);
                                    setContractionsDialogOpen(true);
                                  }}>
                                  <History className="h-3 w-3 mr-1 text-orange-500" />
                                  <span className="text-orange-600">Ver Contrações</span>
                                </Button>
                                <Button size="sm" variant="outline"
                                  className="h-7 px-2.5 text-[11px] border-dashed hover:bg-destructive/10"
                                  onClick={() => handleRegisterBirth(n.client!)}>
                                  <Baby className="h-3 w-3 mr-1 text-destructive" />
                                  <span className="text-destructive">Registrar Nascimento</span>
                                </Button>
                              </>
                            )}

                            {/* Contractions */}
                            {n.type === "contraction" && n.clientId && (
                              <>
                                <Button size="sm" variant="outline"
                                  className="h-7 px-2.5 text-[11px] border-dashed border-orange-300 hover:bg-orange-500/10"
                                  onClick={() => {
                                    const c = clientsMap.get(n.clientId!);
                                    if (c) { handleMarkContractionRead(n.clientId!); setContractionsClient(c); setContractionsDialogOpen(true); }
                                  }}>
                                  <History className="h-3 w-3 mr-1 text-orange-500" />
                                  <span className="text-orange-600">Ver Histórico</span>
                                </Button>
                                {!clientsMap.get(n.clientId!)?.labor_started_at && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 px-2.5 text-[11px] border-dashed hover:bg-destructive/10"
                                    onClick={() => handleStartLabor(n.clientId!)}>
                                    <Activity className="h-3 w-3 mr-1 text-destructive" />
                                    <span className="text-destructive">Registrar Parto</span>
                                  </Button>
                                )}
                                {!n.isRead && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 px-2.5 text-[11px] border-dashed border-muted-foreground/40 hover:bg-muted/30"
                                    onClick={() => handleMarkContractionRead(n.clientId!)}>
                                    <Pause className="h-3 w-3 mr-1 text-muted-foreground" />
                                    <span className="text-muted-foreground">Aguardar</span>
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Diary */}
                            {n.type === "diary" && n.clientId && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2.5 text-[11px] border-dashed border-emerald-300 hover:bg-emerald-500/10"
                                onClick={() => {
                                  const c = clientsMap.get(n.clientId!);
                                  if (c) { setDiaryClient(c); setDiaryDialogOpen(true); }
                                }}>
                                <BookHeart className="h-3 w-3 mr-1 text-emerald-500" />
                                <span className="text-emerald-600">Ver Diário</span>
                              </Button>
                            )}

                            {/* Service requests */}
                            {n.type === "service_request" && n.requestId && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2.5 text-[11px] border-dashed border-purple-300 hover:bg-purple-500/10"
                                onClick={() => handleOpenBudgetDialog(n.requestId!)}>
                                <Send className="h-3 w-3 mr-1 text-purple-500" />
                                <span className="text-purple-600">Enviar Orçamento</span>
                              </Button>
                            )}

                            {/* Appointment requests */}
                            {n.type === "appointment_request" && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2.5 text-[11px] border-dashed hover:bg-blue-500/10"
                                onClick={() => { window.location.href = "/agenda"; }}>
                                <CalendarCheck className="h-3 w-3 mr-1 text-blue-500" />
                                <span className="text-blue-600">Ver Agenda</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BirthRegistrationDialog open={birthDialogOpen} onOpenChange={setBirthDialogOpen} client={selectedClient} />
      <ClientDiaryDialog open={diaryDialogOpen} onOpenChange={setDiaryDialogOpen} client={diaryClient} />
      <ClientContractionsDialog open={contractionsDialogOpen} onOpenChange={setContractionsDialogOpen} client={contractionsClient} />
      <SendBudgetDialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen} serviceRequest={selectedServiceRequest} />
    </>
  );
}
