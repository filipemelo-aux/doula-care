import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Apple,
  Check,
  Crown,
  Loader2,
  RefreshCcw,
  Smartphone,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppStoreSubscriptionService,
  type StoreProduct,
  type BillingPeriod,
  getCurrentPlatform,
  isDevEnvironment,
} from "@/lib/subscriptions/AppStoreSubscriptionService";

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
  if (plan.max_clients === null) features.push("Clientes ilimitados");
  else features.push(`Até ${plan.max_clients} clientes`);
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
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();

  const platform = getCurrentPlatform();
  const isWeb = platform === "web";
  const isDev = isDevEnvironment();

  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const {
    plan: effectivePlan,
    originalPlan,
    isSubscriptionExpired,
    isLoading: planLoading,
  } = usePlanLimits();

  const { data: isLifetime } = useQuery({
    queryKey: ["lifetime-promo", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      const { data } = await supabase
        .from("org_promotions" as any)
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "lifetime_active")
        .limit(1);
      return (data as any[])?.length > 0;
    },
    enabled: !!organizationId,
  });

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

  const { data: storeProducts } = useQuery({
    queryKey: ["store-products", platform],
    queryFn: () => AppStoreSubscriptionService.getProducts(),
  });

  const { data: activeSubscription } = useQuery({
    queryKey: ["my-subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, status, current_period_start, current_period_end, plan_id, platform, product_id"
        )
        .eq("user_id", user.id)
        .in("status", ["active", "grace_period", "billing_issue"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // index store products by plan_id+billing_period for quick lookup
  const productByPlan = useMemo(() => {
    const map = new Map<string, StoreProduct>();
    (storeProducts || []).forEach((p) => {
      // prefer current platform when web shows both
      const key = `${p.planId}:${p.billingPeriod}`;
      const existing = map.get(key);
      if (!existing) map.set(key, p);
    });
    return map;
  }, [storeProducts]);

  const invalidatePlanCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["org-plan"] });
    queryClient.invalidateQueries({ queryKey: ["active-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
  };

  const handleSubscribe = async (plan: PlatformPlan, billingType: BillingPeriod) => {
    const product = productByPlan.get(`${plan.id}:${billingType}`);
    if (!product) {
      toast.error("Este plano ainda não está disponível na loja.");
      return;
    }

    if (isWeb && !isDev) {
      toast.info(
        "Assinaturas são processadas pela loja oficial quando o app estiver instalado no iOS ou Android."
      );
      return;
    }

    setPurchasing(product.productId);
    try {
      toast.loading("Processando assinatura...", { id: "iap" });
      const result = await AppStoreSubscriptionService.purchaseSubscription(
        product.productId
      );
      toast.dismiss("iap");

      if (result.status === "purchased") {
        toast.success("Assinatura ativada com sucesso");
        invalidatePlanCaches();
      } else if (result.status === "cancelled") {
        toast.info("Compra cancelada");
      } else if (result.status === "pending") {
        toast.info("Pagamento em processamento. Confirmaremos em instantes.");
      } else {
        toast.error(result.message || "Não foi possível concluir a assinatura");
      }
    } catch (err: any) {
      toast.dismiss("iap");
      toast.error(err?.message || "Erro inesperado");
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      toast.loading("Restaurando compras...", { id: "restore" });
      const r = await AppStoreSubscriptionService.restorePurchases();
      toast.dismiss("restore");
      if (r.restored) {
        toast.success(r.message);
        invalidatePlanCaches();
      } else {
        toast.info(r.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleActivateFree = () => {
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
  const hasActiveSub = !!activeSubscription && !isSubscriptionExpired;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Assinatura</h1>
        <p className="page-description">
          Escolha o melhor plano para o seu negócio
        </p>
      </div>

      {isWeb && (
        <Card className="card-glass border-amber-400/30 bg-amber-50/50 dark:bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Assinaturas são feitas dentro do aplicativo oficial
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  As assinaturas são processadas pela loja oficial quando o app
                  estiver instalado no iOS (App Store) ou Android (Google Play).
                  {isDev && " Em modo desenvolvimento você pode simular compras."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-glass">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-2xl font-bold text-foreground capitalize">
                {isLifetime ? "Premium Vitalício" : currentPlanSlug}
              </p>
              {isLifetime ? (
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 mt-1">
                  <Crown className="w-3 h-3 mr-1" />
                  Acesso Vitalício
                </Badge>
              ) : activeSubscription ? (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    className={
                      activeSubscription.status === "active"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                        : activeSubscription.status === "grace_period"
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                    }
                  >
                    {activeSubscription.status === "active"
                      ? "Ativo"
                      : activeSubscription.status === "grace_period"
                        ? "Período de tolerância"
                        : "Problema de pagamento"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Válido até {formatDate(activeSubscription.current_period_end)}
                  </span>
                  {(activeSubscription as any).platform === "ios" && (
                    <Badge variant="outline" className="text-xs">
                      <Apple className="w-3 h-3 mr-1" /> App Store
                    </Badge>
                  )}
                  {(activeSubscription as any).platform === "android" && (
                    <Badge variant="outline" className="text-xs">
                      Google Play
                    </Badge>
                  )}
                </div>
              ) : null}
              {isSubscriptionExpired && !isLifetime && (
                <p className="text-sm text-destructive mt-1">
                  Sua assinatura expirou. Renove para reativar os recursos premium.
                </p>
              )}
            </div>

            {!isWeb && !isLifetime && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Restaurar compras
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrentPlan = plan.plan === currentPlanSlug && !isSubscriptionExpired;
          const features = buildFeatureList(plan);
          const monthlyProduct = productByPlan.get(`${plan.id}:monthly`);
          const yearlyProduct = productByPlan.get(`${plan.id}:yearly`);
          const purchasingThis =
            !!purchasing &&
            (purchasing === monthlyProduct?.productId ||
              purchasing === yearlyProduct?.productId);

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
                {plan.is_free ? (
                  <div>
                    <p className="text-3xl font-bold text-foreground">Grátis</p>
                    <p className="text-sm text-muted-foreground">Para sempre</p>
                  </div>
                ) : (
                  (() => {
                    const yearly =
                      plan.price_yearly > 0
                        ? plan.price_yearly
                        : plan.price_monthly * 12;
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
                              {Math.round(
                                (1 - yearly / (plan.price_monthly * 12)) * 100
                              )}
                              % off
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                <div className="space-y-2 min-h-[140px]">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  {isLifetime ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Crown className="w-4 h-4 mr-2" />
                      Acesso Vitalício
                    </Button>
                  ) : plan.is_free ? (
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
                        disabled={purchasingThis || !monthlyProduct}
                      >
                        {purchasing === monthlyProduct?.productId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Assinar mensal — {formatCentavos(plan.price_monthly)}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSubscribe(plan, "yearly")}
                        disabled={purchasingThis || !yearlyProduct}
                      >
                        {purchasing === yearlyProduct?.productId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Assinar anual —{" "}
                        {formatCentavos(
                          plan.price_yearly > 0
                            ? plan.price_yearly
                            : plan.price_monthly * 12
                        )}
                      </Button>
                      {!monthlyProduct && !yearlyProduct && (
                        <p className="text-[11px] text-muted-foreground text-center">
                          Produto não mapeado para esta plataforma.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasActiveSub && (
        <Card className="card-glass">
          <CardContent className="pt-6 text-xs text-muted-foreground">
            Para alterar forma de pagamento, cancelar ou ver histórico de cobranças,
            acesse:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>iOS: Ajustes &gt; Apple ID &gt; Assinaturas</li>
              <li>Android: Google Play &gt; Pagamentos e assinaturas</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
