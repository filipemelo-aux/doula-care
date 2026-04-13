import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, ExternalLink, Loader2, Settings, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { CheckoutTransitionDialog } from "@/components/subscription/CheckoutTransitionDialog";

type BillingType = "monthly" | "yearly";

interface PlatformPlan {
  id: string;
  name: string;
  plan: string;
  price_monthly: number;
  price_yearly: number;
  is_free: boolean;
  max_clients: number | null;
  reports: boolean;
  export_reports: boolean;
  push_notifications: boolean;
  multi_collaborators: boolean;
  max_collaborators: number;
  agenda: boolean;
  financial: boolean;
  expenses: boolean;
  messages: boolean;
}

const planIcons: Record<string, React.ReactNode> = {
  free: <Star className="w-6 h-6" />,
  pro: <Sparkles className="w-6 h-6" />,
  premium: <Crown className="w-6 h-6" />,
};

const planColors: Record<string, string> = {
  free: "border-muted",
  pro: "border-primary/50 ring-1 ring-primary/20",
  premium: "border-amber-500/50 ring-1 ring-amber-500/20",
};

function formatCentavos(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function buildFeatureList(plan: PlatformPlan): string[] {
  const features: string[] = [];
  if (plan.max_clients === null) {
    features.push("Clientes ilimitados");
  } else {
    features.push(`Até ${plan.max_clients} clientes`);
  }
  if (plan.agenda) features.push("Agenda");
  if (plan.financial) features.push("Financeiro");
  if (plan.expenses) features.push("Controle de despesas");
  if (plan.messages) features.push("Mensagens");
  if (plan.reports) features.push("Relatórios");
  if (plan.export_reports) features.push("Exportar relatórios");
  if (plan.push_notifications) features.push("Notificações push");
  if (plan.multi_collaborators) {
    features.push(`Até ${plan.max_collaborators} colaboradores`);
  }
  return features;
}

export default function Subscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    planName: string;
    planPrice: string;
    checkoutUrl: string | null;
    error: string | null;
    pendingPlanId: string | null;
    pendingBillingType: BillingType | null;
  }>({ open: false, planName: "", planPrice: "", checkoutUrl: null, error: null, pendingPlanId: null, pendingBillingType: null });

  const {
    plan: effectivePlan,
    originalPlan,
    isSubscriptionExpired,
    isSubscriptionPending,
    subscriptionEndDate,
    isLoading: planLoading,
  } = usePlanLimits();

  // Handle Stripe redirect success
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success === "true" && sessionId) {
      toast.success("Pagamento confirmado! Seu plano foi ativado.");
      supabase.functions.invoke("check-subscription").then(({ data }) => {
        if (data?.subscribed) {
          queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
          queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
          queryClient.invalidateQueries({ queryKey: ["org-plan"] });
          queryClient.invalidateQueries({ queryKey: ["active-subscription"] });
          queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
        }
      });
      setSearchParams({}, { replace: true });
    }
    const canceled = searchParams.get("canceled");
    if (canceled === "true") {
      toast.info("Pagamento cancelado.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["platform-plans-subscription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("*")
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return data as unknown as PlatformPlan[];
    },
  });

  const { data: activeSubscription } = useQuery({
    queryKey: ["my-subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_start, current_period_end, plan_id")
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao abrir portal");
    },
  });

  const handleSubscribe = async (plan: PlatformPlan, billingType: BillingType) => {
    const price = billingType === "yearly"
      ? (plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12)
      : plan.price_monthly;

    setCheckoutDialog({
      open: true,
      planName: plan.name,
      planPrice: formatCentavos(price) + (billingType === "yearly" ? "/ano" : "/mês"),
      checkoutUrl: null,
      error: null,
      pendingPlanId: plan.id,
      pendingBillingType: billingType,
    });

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan_id: plan.id, billing_type: billingType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCheckoutDialog((prev) => ({ ...prev, checkoutUrl: data.url }));
    } catch (err: any) {
      setCheckoutDialog((prev) => ({
        ...prev,
        error: err?.message || "Erro ao iniciar pagamento",
      }));
    }
  };

  const handleRetryCheckout = () => {
    const plan = plans?.find((p) => p.id === checkoutDialog.pendingPlanId);
    if (plan && checkoutDialog.pendingBillingType) {
      handleSubscribe(plan, checkoutDialog.pendingBillingType);
    }
  };

  const handleActivateFree = async () => {
    toast.success("Plano gratuito ativado!");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  if (isLoading || planLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Assinatura</h1>
          <p className="page-description">Gerencie seu plano</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[420px]" />
          ))}
        </div>
      </div>
    );
  }

  const currentPlanSlug = originalPlan;
  const hasActiveSub = activeSubscription?.status === "active" && !isSubscriptionExpired;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Assinatura</h1>
        <p className="page-description">
          Escolha o melhor plano para o seu negócio
        </p>
      </div>

      {/* Current Plan Status */}
      <Card className="card-glass">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-2xl font-bold text-foreground capitalize">
                {currentPlanSlug}
              </p>
              {activeSubscription && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={activeSubscription.status === "active" ? "default" : "secondary"}
                    className={
                      activeSubscription.status === "active"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                        : ""
                    }
                  >
                    {activeSubscription.status === "active"
                      ? "Ativo"
                      : activeSubscription.status === "pending"
                        ? "Pendente"
                        : "Cancelado"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Válido até {formatDate(activeSubscription.current_period_end)}
                  </span>
                </div>
              )}
              {isSubscriptionExpired && (
                <p className="text-sm text-destructive mt-1">
                  Sua assinatura expirou. Renove para reativar os recursos premium.
                </p>
              )}
            </div>
            {hasActiveSub && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                Gerenciar assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrentPlan = plan.plan === currentPlanSlug && !isSubscriptionExpired;
          const features = buildFeatureList(plan);

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all card-glass ${
                planColors[plan.plan] || ""
              } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
            >
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center text-xs py-1 font-medium">
                  Plano atual
                </div>
              )}

              <CardHeader className={isCurrentPlan ? "pt-10" : ""}>
                <div className="flex items-center gap-2 text-foreground">
                  {planIcons[plan.plan]}
                  <CardTitle className="text-xl font-display capitalize">
                    {plan.name}
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                {plan.is_free ? (
                  <div>
                    <p className="text-3xl font-bold text-foreground">Grátis</p>
                    <p className="text-sm text-muted-foreground">Para sempre</p>
                  </div>
                ) : (
                  (() => {
                    const yearly = plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12;
                    const hasDiscount = yearly < plan.price_monthly * 12;
                    return (
                      <div className="space-y-1">
                        <div>
                          <span className="text-3xl font-bold text-foreground">
                            {formatCentavos(plan.price_monthly)}
                          </span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                        <div>
                          <span className="text-lg font-semibold text-muted-foreground">
                            {formatCentavos(yearly)}
                          </span>
                          <span className="text-xs text-muted-foreground">/ano</span>
                          {hasDiscount && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {Math.round((1 - yearly / (plan.price_monthly * 12)) * 100)}% off
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Features */}
                <div className="space-y-2 min-h-[140px]">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="space-y-2 pt-4 border-t border-border">
                  {plan.is_free ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isCurrentPlan}
                      onClick={handleActivateFree}
                    >
                      {isCurrentPlan ? "Plano atual" : "Ativar plano gratuito"}
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(plan, "monthly")}
                        disabled={checkoutDialog.open}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Assinar mensal — {formatCentavos(plan.price_monthly)}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSubscribe(plan, "yearly")}
                        disabled={checkoutDialog.open}
                      >
                        Assinar anual — {formatCentavos(plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12)}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CheckoutTransitionDialog
        open={checkoutDialog.open}
        onOpenChange={(o) => setCheckoutDialog((prev) => ({ ...prev, open: o }))}
        planName={checkoutDialog.planName}
        planPrice={checkoutDialog.planPrice}
        checkoutUrl={checkoutDialog.checkoutUrl}
        error={checkoutDialog.error}
        onRetry={handleRetryCheckout}
      />
    </div>
  );
}
