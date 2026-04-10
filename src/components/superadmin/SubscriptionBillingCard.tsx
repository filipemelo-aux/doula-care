import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard, CheckCircle, Clock, RefreshCw, Users, DollarSign, Loader2,
} from "lucide-react";

interface PlanPaymentRow {
  id: string;
  user_id: string;
  plan_id: string;
  order_nsu: string;
  amount: number;
  billing_type: string;
  status: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
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
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch plan_payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["sa-plan-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlanPaymentRow[];
    },
  });

  // Fetch active subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["sa-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, user_id, plan_id, status, current_period_end")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SubscriptionRow[];
    },
  });

  // Fetch profiles for user names
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

  // Fetch plans
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

  // Resend charge mutation
  const resendMutation = useMutation({
    mutationFn: async (payment: PlanPaymentRow) => {
      const { data, error } = await supabase.functions.invoke(
        "create-pix-payment-for-plan",
        {
          body: { plan_id: payment.plan_id, billing_type: payment.billing_type },
          headers: {
            // Use service role to act on behalf of the user
            // We pass user_id in body but the function uses auth header
            // For super admin, we just regenerate a new payment
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-plan-payments"] });
      toast.success("Nova cobrança gerada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao reenviar cobrança");
    },
  });

  const getUserName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.full_name || userId.slice(0, 8);
  };

  const getPlanName = (planId: string) => {
    const p = plans.find((pl) => pl.id === planId);
    return p?.name || "—";
  };

  const getPlanSlug = (planId: string) => {
    const p = plans.find((pl) => pl.id === planId);
    return p?.plan || "";
  };

  // Metrics
  const totalReceived = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const activeSubscriptionCount = subscriptions.filter(
    (s) => s.status === "active"
  ).length;

  // Filtered payments
  const filtered = payments.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (planFilter !== "all" && getPlanSlug(p.plan_id) !== planFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = statusBadge[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return <Badge className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  if (paymentsLoading) {
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
        Assinaturas & Cobranças ({payments.length})
      </h2>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200/50 dark:bg-emerald-800/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {formatCentavos(totalReceived)}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Total recebido
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={totalPending > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/50 dark:bg-amber-800/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {formatCentavos(totalPending)}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Total pendente
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {activeSubscriptionCount}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Assinaturas ativas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {plans
              .filter((p) => !(p as any).is_free)
              .map((p) => (
                <SelectItem key={p.id} value={p.plan}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma cobrança encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">
                  Usuário
                </th>
                <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">
                  Plano
                </th>
                <th className="text-right p-2.5 text-xs font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">
                  Data
                </th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-2.5 text-foreground font-medium truncate max-w-[140px]">
                    {getUserName(payment.user_id)}
                  </td>
                  <td className="p-2.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {getPlanName(payment.plan_id)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {payment.billing_type === "yearly" ? "anual" : "mensal"}
                    </span>
                  </td>
                  <td className="p-2.5 text-right font-medium text-foreground">
                    {formatCentavos(payment.amount)}
                  </td>
                  <td className="p-2.5 text-center">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="p-2.5 text-muted-foreground text-xs">
                    {format(new Date(payment.created_at), "dd/MM/yy HH:mm", {
                      locale: ptBR,
                    })}
                  </td>
                  <td className="p-2.5 text-center">
                    {payment.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(payment)}
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Reenviar
                      </Button>
                    )}
                    {payment.status === "paid" && (
                      <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
