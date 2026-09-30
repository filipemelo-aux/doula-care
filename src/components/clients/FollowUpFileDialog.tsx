import { expandFeatures } from "@/lib/planFeatures";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CreditCard,
  ListChecks,
  StickyNote,
  CheckCircle2,
  Calendar,
  UserRound,
  Stethoscope,
  Camera,
} from "lucide-react";
import { cn, formatBrazilDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { usePlanNames } from "@/hooks/usePlanNames";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import type { FollowupSession } from "@/lib/consultations";

type Client = Tables<"clients">;

interface FollowUpFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const statusLabels: Record<string, string> = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Puérpera",
  outro: "Outro",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

const paymentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function FollowUpFileDialog({ open, onOpenChange, client }: FollowUpFileDialogProps) {
  const { getPlanName } = usePlanNames();
  const { role } = useAuth();

  const { data: avatarUrl } = useQuery({
    queryKey: ["followup-file-avatar", client?.user_id],
    enabled: open && !!client?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", client!.user_id!)
        .maybeSingle();
      return data?.avatar_url ?? null;
    },
  });

  // Transação automática do contrato (mesma lógica do acompanhamento/edição)
  const { data: clientTransaction } = useQuery({
    queryKey: ["client-transaction", client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, installments, installment_value, payment_method, date, amount_received")
        .eq("client_id", client.id)
        .eq("is_auto_generated", true)
        .eq("type", "receita")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!client?.id,
  });

  // Parcelas (mesma lógica da edição do acompanhamento, com fallback legacy)
  const { data: installmentPayments } = useQuery({
    queryKey: ["client-installment-payments", client?.id, clientTransaction?.id],
    queryFn: async () => {
      if (!client?.id) return [];

      if (clientTransaction?.id) {
        const { data: byTx, error: byTxErr } = await supabase
          .from("payments")
          .select("amount, amount_paid, due_date, installment_number, total_installments, transaction_id")
          .eq("transaction_id", clientTransaction.id)
          .order("installment_number", { ascending: true });

        if (byTxErr) throw byTxErr;
        if (byTx && byTx.length > 0) return byTx;
      }

      const { data: legacy, error: legacyErr } = await supabase
        .from("payments")
        .select("amount, amount_paid, due_date, installment_number, total_installments, transaction_id")
        .eq("client_id", client.id)
        .is("transaction_id", null)
        .order("installment_number", { ascending: true });

      if (legacyErr) throw legacyErr;
      return legacy || [];
    },
    enabled: open && !!client?.id,
  });

  // Serviços inclusos do plano + sinalizações da cliente
  const { data: planFeatures = [] } = useQuery({
    queryKey: ["followup-file-plan-features", client?.plan_setting_id],
    enabled: open && !!client?.plan_setting_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("features")
        .eq("id", client!.plan_setting_id!)
        .maybeSingle();
      if (error) throw error;
      return expandFeatures(data?.features);
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["followup-file-sessions", client?.id],
    enabled: open && !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followup_sessions")
        .select("id, client_id, service_name, sequence, status, performed_at, notes, appointment_id, appointments(scheduled_at, completed_at)")
        .eq("client_id", client!.id);
      if (error) throw error;
      return (data || []) as FollowupSession[];
    },
  });

  const includedItems = useMemo(() => {
    const mine = sessions;
    return planFeatures.map((name, i) => {
      const session = mine.find((s) => s.sequence === i + 1) || mine.find((s) => s.sequence == null && s.service_name === name);
      return { name, key: `${name}:${i}`, session };
    });
  }, [planFeatures, sessions]);

  if (!client) return null;


  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const initials = client.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const paidInstallments = (installmentPayments || []).filter((p) => Number(p.amount_paid || 0) > 0).length;
  const receivedTotal = (installmentPayments || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const doneItems = includedItems.filter((it) => it.session?.status === "done").length;
  const team = Array.isArray(client.prenatal_team) ? client.prenatal_team : [];
  const paymentType = (installmentPayments?.length || Number(clientTransaction?.installments || 1)) > 1 ? "Parcelado" : "À vista";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94%] max-w-lg max-h-[90dvh] min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden gap-0 rounded-3xl [&>div]:!block [&>div]:!min-w-0 [&>div]:!p-0 [&>div]:!max-h-[90dvh] [&>div]:!overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Acompanhamento</DialogTitle>
        </DialogHeader>

        <div className="w-full min-w-0">
          {/* Hero */}
          <div className="relative px-6 pt-7 pb-6 bg-gradient-to-br from-primary/15 to-accent/5">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 shadow-md ring-2 ring-background">
                <AvatarImage src={avatarUrl || undefined} alt={client.full_name} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25 text-primary font-semibold">
                  {initials || <UserRound className="w-6 h-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-semibold text-foreground leading-tight break-words">
                  {client.full_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge variant="outline" className={cn("badge-status border-0", `badge-${client.status}`)}>
                    {statusLabels[client.status] || client.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                    {getPlanName(client.plan_setting_id, client.plan)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="min-w-0 px-4 sm:px-5 py-5 space-y-4">
            {(client.dpp || client.baby_names?.length || client.birth_location || client.prenatal_type || client.prenatal_high_risk || team.length > 0 || client.has_fotografa || client.status === "outro") && (
              <Card icon={Stethoscope} title="Gestação e pré-natal" tint="primary">
                <ChipGrid>
                  {client.status === "outro" && client.custom_status && <Chip label="Situação" value={client.custom_status} />}
                  {client.dpp && <Chip label="DPP" value={formatDate(client.dpp)} />}
                  {client.baby_names && client.baby_names.length > 0 && <Chip label="Bebê(s)" value={client.baby_names.join(", ")} />}
                  {client.birth_location && <Chip label="Local do parto" value={client.birth_location} />}
                  {client.prenatal_type && <Chip label="Tipo de atendimento" value={{ sus: "SUS", plano: "Plano de Saúde", particular: "Particular", equipe_particular: "Equipe Particular" }[client.prenatal_type] || client.prenatal_type} />}
                  <Chip label="Alto risco" value={client.prenatal_high_risk ? "Sim" : "Não"} />
                  <Chip label="Equipe particular" value={team.length > 0 ? "Sim" : "Não"} />
                </ChipGrid>
                {team.length > 0 && <div className="mt-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Equipe</p>
                  {team.map((member, i) => {
                    if (!member || typeof member !== "object" || Array.isArray(member)) return null;
                    return <p key={i} className="text-xs break-words rounded-lg bg-muted/50 p-2">{String(member.name || "")} {member.role ? `— ${String(member.role)}` : ""}</p>;
                  })}
                </div>}
                <div className="mt-3 flex items-start gap-2 text-xs">
                  <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">Fotógrafa: {client.has_fotografa ? [client.fotografa_name, client.fotografa_phone].filter(Boolean).join(" · ") || "Sim" : "Não"}</span>
                </div>
              </Card>
            )}
            {/* Serviços inclusos */}

            {/* Serviços inclusos */}
            <Card
              icon={ListChecks}
              title={`Serviços inclusos (${doneItems}/${includedItems.length} executados)`}
              tint="accent"
            >
              {includedItems.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-2">
                  O plano não tem serviços inclusos cadastrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {includedItems.map((it) => {
                    const isDone = it.session?.status === "done";
                    return (
                      <div key={it.key} className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
                            )}
                            <p className="font-medium text-xs break-words">{it.name}</p>
                          </div>
                          <Badge variant={isDone ? "default" : "outline"} className="text-[10px] h-5 shrink-0">
                            {isDone ? "Executado" : "Não sinalizado"}
                          </Badge>
                        </div>
                        {isDone && it.session?.performed_at && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatBrazilDate(it.session.performed_at)}
                          </p>
                        )}
                        {it.session?.notes && (
                          <p className="text-[11px]"><span className="text-muted-foreground">Obs:</span> {it.session.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Observações */}
            {client.notes && (
              <Card icon={StickyNote} title="Observações" tint="accent">
                <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {client.notes}
                </p>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const tintClasses: Record<string, { bg: string; icon: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary" },
  accent: { bg: "bg-accent/20", icon: "text-accent-foreground" },
};

function Card({
  icon: Icon,
  title,
  tint = "primary",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint?: "primary" | "accent";
  children: React.ReactNode;
}) {
  const t = tintClasses[tint];
  return (
     <div className="min-w-0 rounded-2xl bg-card border border-border/40 shadow-sm p-4 space-y-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", t.bg)}>
          <Icon className={cn("w-4 h-4", t.icon)} />
        </div>
         <h3 className="font-semibold text-sm text-foreground min-w-0 break-words">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
   return <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 min-w-0">{children}</div>;
}

function Chip({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 min-w-0",
        highlight ? "bg-primary/10" : "bg-muted/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-primary shrink-0" />}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      </div>
       <p className={cn("text-xs font-medium break-words [overflow-wrap:anywhere]", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
