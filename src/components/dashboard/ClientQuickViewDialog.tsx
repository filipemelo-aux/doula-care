import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  CalendarPlus,
  BookHeart,
  Activity,
  FileText,
  Bell,
  Baby,
  Heart,
  Phone,
  Calendar,
  MapPin,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBrazilDate } from "@/lib/utils";
import {
  calculateCurrentPregnancyWeeks,
  calculateCurrentPregnancyDays,
  isPostTerm,
} from "@/lib/pregnancy";
import { Tables } from "@/integrations/supabase/types";
import { useState } from "react";
import { ClientDiaryDialog } from "./ClientDiaryDialog";
import { ClientContractionsDialog } from "./ClientContractionsDialog";
import { SendNotificationDialog } from "@/components/clients/SendNotificationDialog";
import { ClientFileDialog } from "@/components/clients/ClientFileDialog";

type Client = Tables<"clients">;

interface ClientQuickViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0];
}

export function ClientQuickViewDialog({
  open,
  onOpenChange,
  clientId,
}: ClientQuickViewDialogProps) {
  const navigate = useNavigate();
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [contractionsOpen, setContractionsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-quickview", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  const { data: avatar } = useQuery({
    queryKey: ["client-quickview-avatar", client?.user_id],
    enabled: !!client?.user_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", client!.user_id!)
        .maybeSingle();
      return data?.avatar_url ?? null;
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["client-quickview-activity", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const [msgs, diary, svc, apt, lastDiary, nextAppt] = await Promise.all([
        supabase
          .from("client_notifications")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId!)
          .eq("read", false)
          .like("title", "Mensagem de %"),
        supabase
          .from("pregnancy_diary")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId!)
          .eq("read_by_admin", false),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId!)
          .eq("status", "pending"),
        supabase
          .from("appointment_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId!)
          .eq("status", "pending"),
        supabase
          .from("pregnancy_diary")
          .select("created_at, emotion, content")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, title, scheduled_at")
          .eq("client_id", clientId!)
          .is("completed_at", null)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        unreadMessages: msgs.count ?? 0,
        unreadDiary: diary.count ?? 0,
        pendingServices: svc.count ?? 0,
        pendingAppointments: apt.count ?? 0,
        lastDiary: lastDiary.data,
        nextAppointment: nextAppt.data,
      };
    },
    refetchInterval: 30000,
  });

  const isPuer = client?.status === "lactante";
  const isGest = client?.status === "gestante";

  const gestBadge = useMemo(() => {
    if (!client || !isGest) return null;
    const w = calculateCurrentPregnancyWeeks(
      client.pregnancy_weeks,
      client.pregnancy_weeks_set_at,
      client.dpp,
    );
    if (w === null) return null;
    const d = calculateCurrentPregnancyDays(client.dpp);
    const post = isPostTerm(client.dpp);
    return { w, d, post };
  }, [client, isGest]);

  const name = client
    ? (client.preferred_name?.trim() || firstName(client.full_name))
    : "";

  const go = (path: string, state?: unknown) => {
    onOpenChange(false);
    setTimeout(() => navigate(path, state ? { state } : undefined), 60);
  };

  const inLabor = !!client?.labor_started_at && !client?.birth_occurred;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0 rounded-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{name || "Cliente"}</DialogTitle>
            <DialogDescription>Ações rápidas</DialogDescription>
          </DialogHeader>

          {isLoading || !client ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                className={cn(
                  "relative px-6 pt-7 pb-6 bg-gradient-to-br",
                  inLabor
                    ? "from-destructive/15 to-destructive/5"
                    : "from-primary/15 to-accent/5",
                )}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 shadow-md ring-2 ring-background">
                    <AvatarImage
                      src={avatar || undefined}
                      alt={name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25">
                      {isPuer ? (
                        <Heart className="w-6 h-6 text-primary" />
                      ) : (
                        <Baby className="w-6 h-6 text-primary" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl font-semibold text-foreground truncate">
                      {name}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.full_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {gestBadge && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-5",
                            gestBadge.post
                              ? "bg-red-100 text-red-700 border-red-200"
                              : gestBadge.w >= 40
                              ? "bg-orange-100 text-orange-700 border-orange-200"
                              : "bg-primary/10 text-primary border-primary/20",
                          )}
                        >
                          {gestBadge.w}s {gestBadge.d}d
                          {gestBadge.post && " · pós-data"}
                        </Badge>
                      )}
                      {isPuer && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 bg-accent/20 text-accent-foreground border-accent/30"
                        >
                          Puérpera
                        </Badge>
                      )}
                      {inLabor && (
                        <Badge className="text-[10px] h-5 bg-destructive text-destructive-foreground animate-pulse">
                          Em trabalho de parto
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Info chips */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {client.dpp && (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          DPP
                        </p>
                        <p className="font-medium truncate">
                          {formatBrazilDate(client.dpp)}
                        </p>
                      </div>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Telefone
                        </p>
                        <p className="font-medium truncate">{client.phone}</p>
                      </div>
                    </div>
                  )}
                  {(client.city || client.neighborhood) && (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 col-span-2">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="font-medium truncate">
                        {[client.neighborhood, client.city, client.state]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Novidades */}
                {activity &&
                  (activity.unreadMessages +
                    activity.unreadDiary +
                    activity.pendingServices +
                    activity.pendingAppointments >
                    0) && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-destructive" />
                        <p className="text-sm font-semibold text-foreground">
                          Novidades
                        </p>
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {activity.unreadMessages > 0 && (
                          <li className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Mensagens não lidas
                            </span>
                            <span className="font-semibold text-destructive">
                              {activity.unreadMessages}
                            </span>
                          </li>
                        )}
                        {activity.unreadDiary > 0 && (
                          <li className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Novas entradas de diário
                            </span>
                            <span className="font-semibold text-destructive">
                              {activity.unreadDiary}
                            </span>
                          </li>
                        )}
                        {activity.pendingAppointments > 0 && (
                          <li className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Solicitações de consulta
                            </span>
                            <span className="font-semibold text-destructive">
                              {activity.pendingAppointments}
                            </span>
                          </li>
                        )}
                        {activity.pendingServices > 0 && (
                          <li className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Solicitações de serviço
                            </span>
                            <span className="font-semibold text-destructive">
                              {activity.pendingServices}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                {/* Próxima consulta */}
                {activity?.nextAppointment && (
                  <div className="rounded-2xl bg-primary/5 border border-primary/10 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Próxima consulta
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {activity.nextAppointment.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(
                        activity.nextAppointment.scheduled_at,
                      ).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}

                {/* Último diário */}
                {activity?.lastDiary && (
                  <button
                    onClick={() => setDiaryOpen(true)}
                    className="w-full text-left rounded-2xl bg-muted/50 hover:bg-muted p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <BookHeart className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                          Último diário
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">
                      {activity.lastDiary.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatBrazilDate(activity.lastDiary.created_at)}
                    </p>
                  </button>
                )}

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <ActionButton
                    icon={MessageCircle}
                    label="Mensagem"
                    onClick={() => go(`/mensagens?clientId=${client.id}`)}
                    badge={activity?.unreadMessages}
                  />
                  <ActionButton
                    icon={CalendarPlus}
                    label="Agendar"
                    onClick={() =>
                      go("/agenda", { openDialog: "consulta" })
                    }
                  />
                  <ActionButton
                    icon={BookHeart}
                    label="Diário"
                    onClick={() => setDiaryOpen(true)}
                    badge={activity?.unreadDiary}
                  />
                  {isGest && (
                    <ActionButton
                      icon={Activity}
                      label="Contrações"
                      onClick={() => setContractionsOpen(true)}
                      highlight={inLabor}
                    />
                  )}
                  <ActionButton
                    icon={Bell}
                    label="Notificar"
                    onClick={() => setNotifOpen(true)}
                  />
                  <ActionButton
                    icon={FileText}
                    label="Ficha"
                    onClick={() =>
                      go("/clientes", { openClientId: client.id })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClientDiaryDialog
        open={diaryOpen}
        onOpenChange={setDiaryOpen}
        client={client ?? null}
      />
      <ClientContractionsDialog
        open={contractionsOpen}
        onOpenChange={setContractionsOpen}
        client={client ?? null}
      />
      <SendNotificationDialog
        open={notifOpen}
        onOpenChange={setNotifOpen}
        client={client ?? null}
      />
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  badge,
  highlight,
}: {
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 transition-all active:scale-[0.96]",
        highlight
          ? "bg-destructive/10 hover:bg-destructive/15 text-destructive"
          : "bg-muted/50 hover:bg-primary/10 text-foreground",
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5",
          highlight ? "text-destructive" : "text-primary",
        )}
      />
      <span className="text-[11px] font-medium leading-tight">{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
