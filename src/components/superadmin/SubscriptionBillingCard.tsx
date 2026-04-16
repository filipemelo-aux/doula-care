import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard, CheckCircle, Clock, Users, DollarSign, Loader2, CalendarClock, Send, AlertCircle,
} from "lucide-react";

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  current_period_start: string | null;
  stripe_subscription_id: string | null;
}

interface ProfileInfo {
  user_id: string;
  full_name: string | null;
  organization_id: string | null;
}

interface PlanInfo {
  id: string;
  name: string;
  plan: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  pending: { label: "Pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  active: { label: "Ativa", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  canceled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

function formatCentavos(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SubscriptionBillingCard() {
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["sa-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, user_id, plan_id, status, current_period_end, current_period_start, stripe_subscription_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SubscriptionRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-profiles-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, organization_id");
      if (error) throw error;
      return data as ProfileInfo[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["sa-platform-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("id, name, plan");
      if (error) throw error;
      return data as unknown as PlanInfo[];
    },
  });

  const sendBillingMutation = useMutation({
    mutationFn: async (sub: SubscriptionRow) => {
      const profile = profiles.find((p) => p.user_id === sub.user_id);
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const plan = plans.find((p) => p.id === sub.plan_id);
      const planName = plan?.name || "Plano";
      const endDate = sub.current_period_end
        ? format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })
        : "—";

      const { error } = await supabase.from("org_notifications").insert({
        organization_id: profile.organization_id,
        title: "💳 Cobrança de Assinatura",
        message: `Sua assinatura do plano ${planName} vence em ${endDate}. Renove para continuar utilizando todos os recursos.`,
        type: "billing",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança enviada com sucesso!");
    },
    onError: () => toast.error("Erro ao enviar cobrança"),
  });

  const getUserName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.full_name || userId.slice(0, 8);
  };

  const getPlanName = (planId: string) => {
    const p = plans.find((pl) => pl.id === planId);
    return p?.name || "—";
  };

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const activeSubscriptionCount = activeSubscriptions.length;

  // Sort by nearest expiration first
  const sortedSubs = [...activeSubscriptions].sort((a, b) => {
    const dateA = a.current_period_end ? new Date(a.current_period_end).getTime() : Infinity;
    const dateB = b.current_period_end ? new Date(b.current_period_end).getTime() : Infinity;
    return dateA - dateB;
  });

  const expiringSoon = sortedSubs.filter((s) => {
    if (!s.current_period_end) return false;
    return differenceInDays(new Date(s.current_period_end), new Date()) <= 7;
  });

  const getStatusBadge = (status: string) => {
    const s = statusBadge[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return <Badge className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  if (subsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        Assinaturas & Cobranças
      </h2>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{activeSubscriptionCount}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Assinaturas ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className={expiringSoon.length > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/50 dark:bg-amber-800/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{expiringSoon.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Vencem em 7 dias</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200/50 dark:bg-emerald-800/30 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{subscriptions.filter((s) => s.status === "canceled").length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Canceladas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Renewals */}
      {sortedSubs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Próximos Vencimentos ({sortedSubs.length})
          </h3>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Doula</th>
                  <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Plano</th>
                  <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">Dias</th>
                  <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubs.map((sub) => {
                  const daysLeft = sub.current_period_end
                    ? differenceInDays(new Date(sub.current_period_end), new Date())
                    : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 7;
                  return (
                    <tr key={sub.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${isUrgent ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                      <td className="p-2.5 text-foreground font-medium truncate max-w-[160px]">
                        {getUserName(sub.user_id)}
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {getPlanName(sub.plan_id)}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-center">
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className="p-2.5 text-muted-foreground text-xs">
                        {sub.current_period_end
                          ? format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="p-2.5 text-center">
                        {daysLeft !== null ? (
                          <span className={`text-xs font-medium ${daysLeft <= 3 ? "text-destructive" : daysLeft <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                            {daysLeft}d
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={sendBillingMutation.isPending}
                          onClick={() => {
                            if (confirm(`Enviar cobrança para ${getUserName(sub.user_id)}?`)) {
                              sendBillingMutation.mutate(sub);
                            }
                          }}
                        >
                          {sendBillingMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Cobrar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subscriptions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma assinatura encontrada
          </CardContent>
        </Card>
      )}
    </div>
  );
}