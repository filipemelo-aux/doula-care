import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useHideFreePlan } from "@/hooks/useHideFreePlan";
import { useIsMobile } from "@/hooks/use-mobile";
import { PixSubscriptionDialog } from "@/components/subscription/PixSubscriptionDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Apple,
  Check,
  Crown,
  Loader2,
  QrCode,
  RefreshCcw,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppStoreSubscriptionService,
  type StoreProduct,
  type BillingPeriod,
  getCurrentPlatform,
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

interface CouponOffer {
  plan: string | null;
  billing_period: "monthly" | "yearly" | "both";
  discount_type: "amount" | "percent";
  discount_amount: number | null;
  discount_percent: number | null;
}

/** Desconto em centavos que o cupom aplica sobre um valor base. */
function couponDiscountCents(
  offers: CouponOffer[] | undefined,
  planSlug: string,
  billing: BillingPeriod,
  baseCents: number
): number {
  const offer = (offers || []).find(
    (o) =>
      (!o.plan || o.plan === planSlug) &&
      (o.billing_period === "both" || o.billing_period === billing)
  );
  if (!offer) return 0;
  const cents =
    offer.discount_type === "percent"
      ? Math.round((baseCents * (offer.discount_percent ?? 0)) / 100)
      : offer.discount_amount ?? 0;
  return Math.min(baseCents, Math.max(0, cents));
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

  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [managing, setManaging] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    description: string;
    offers?: CouponOffer[];
  } | null>(null);
  const [pixCheckout, setPixCheckout] = useState<{
    planId: string;
    planName: string;
    billingType: BillingPeriod;
    amountCents: number;
    originalAmountCents: number;
  } | null>(null);

  const isMobileViewport = useIsMobile();
  // Pix de assinatura existe apenas no navegador em tela grande
  const pixEnabled = isWeb && !isMobileViewport;

  // Pagamento exclusivamente pelas lojas oficiais (regra 3.1.1 da Apple)

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

  const { data: myCoupon } = useQuery({
    queryKey: ["my-subscription-coupon", organizationId, platform],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data } = await supabase
        .from("subscription_coupons" as any)
        .select("id, code, description, expires_at, platform, organization_id")
        // só cupons direcionados a esta doula aparecem sozinhos;
        // cupons gerais precisam ser digitados por quem recebeu o código
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("platform", platform === "web" ? ["both", "ios", "android"] : ["both", platform])
        .order("created_at", { ascending: false });
      const rows = ((data as any[]) || []).filter(
        (r) => !r.expires_at || new Date(r.expires_at) >= new Date()
      );
      return rows[0] ?? null;
    },
    enabled: !!organizationId,
  });

  const hideFreePlan = useHideFreePlan();

  const { data: allPlans, isLoading } = useQuery({
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

  const plans = hideFreePlan
    ? (allPlans || []).filter((p) => !p.is_free)
    : allPlans;


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

  // Retorno do checkout web: confirma a assinatura com o provedor de pagamento
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (checkout === "cancel") {
      toast.info("Pagamento cancelado");
      return;
    }
    (async () => {
      toast.loading("Confirmando pagamento...", { id: "confirm" });
      try {
        await supabase.functions.invoke("check-subscription");
      } catch {
        /* a confirmação também chega pelo webhook */
      }
      toast.dismiss("confirm");
      toast.success("Assinatura confirmada!");
      invalidatePlanCaches();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (
    plan: PlatformPlan,
    billingType: BillingPeriod,
    method: "card" | "pix" = "card"
  ) => {
    const product = productByPlan.get(`${plan.id}:${billingType}`);

    if (isWeb) {
      setPurchasing(
        method === "pix"
          ? `pix:${plan.id}:${billingType}`
          : product?.productId || `${plan.id}:${billingType}`
      );
      try {
        toast.loading("Abrindo pagamento seguro...", { id: "checkout" });
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: {
            plan: plan.plan,
            billing: billingType,
            method,
            coupon: appliedCoupon?.code || undefined,
          },
        });
        toast.dismiss("checkout");
        if (error) throw error;
        if (!data?.url) throw new Error("Não foi possível iniciar o pagamento");
        window.location.href = data.url;
      } catch (err: any) {
        toast.dismiss("checkout");
        toast.error(err?.message || "Não foi possível iniciar o pagamento");
      } finally {
        setPurchasing(null);
      }
      return;
    }

    if (!product) {
      toast.error("Este plano ainda não está disponível.");
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

  const handleRedeemCoupon = async (rawCode: string, couponId?: string) => {
    const code = rawCode.trim().toUpperCase();
    if (code.length < 3) return;
    setRedeeming(true);
    try {
      if (isWeb) {
        // No navegador o desconto é validado no checkout por cartão
        const { data, error } = await supabase.functions.invoke("validate-coupon", {
          body: { code },
        });
        if (error) throw error;
        if (data?.valid) {
          setAppliedCoupon({ code: data.code, description: data.description });
          toast.success(`Cupom aplicado: ${data.description}`);
        } else {
          setAppliedCoupon(null);
          toast.error(data?.message || "Cupom inválido");
        }
        return;
      }

      const result = await AppStoreSubscriptionService.redeemOfferCode(code);
      if (result.ok) {
        toast.success(result.message);
        if (couponId) {
          await supabase
            .from("subscription_coupons" as any)
            .update({ redeemed_at: new Date().toISOString() } as any)
            .eq("id", couponId);
        }
        invalidatePlanCaches();
      } else {
        toast.info(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível aplicar o cupom");
    } finally {
      setRedeeming(false);
    }
  };

  const handleManageSubscription = async () => {
    setManaging(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (!data?.url) throw new Error("Não foi possível abrir o gerenciamento");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o gerenciamento");
    } finally {
      setManaging(false);
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
    <div className="space-y-6 pb-20">
      <div className="page-header">
        <h1 className="page-title">Assinatura</h1>
        <p className="page-description">
          Escolha o melhor plano para o seu negócio
        </p>
      </div>


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

            {isWeb && !isLifetime && activeSubscription ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={managing}
              >
                {managing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Gerenciar assinatura
              </Button>
            ) : null}

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

      <Card className="card-glass">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <p className="font-semibold text-foreground">Cupom de desconto</p>
          </div>

          {appliedCoupon ? (
            <div className="rounded-xl bg-primary/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-foreground">
                    {appliedCoupon.code}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Aplicado
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {appliedCoupon.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAppliedCoupon(null);
                  setCouponInput("");
                }}
              >
                Remover
              </Button>
            </div>
          ) : myCoupon ? (
            <div className="rounded-xl bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-foreground">
                    {myCoupon.code}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Desconto
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {myCoupon.description ||
                    "Cupom liberado para você. Aplique para ver o desconto antes de confirmar o pagamento."}
                  {myCoupon.expires_at
                    ? ` · válido até ${formatDate(myCoupon.expires_at)}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={redeeming}
                onClick={() =>
                  handleRedeemCoupon(
                    myCoupon.code,
                    myCoupon.organization_id ? myCoupon.id : undefined
                  )
                }
              >
                {redeeming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Aplicar desconto
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Digite seu código"
                className="sm:max-w-xs font-mono"
              />
              <Button
                variant="outline"
                disabled={redeeming || couponInput.trim().length < 3}
                onClick={() => handleRedeemCoupon(couponInput)}
              >
                {redeeming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Aplicar
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            O desconto é aplicado automaticamente no valor cobrado.
          </p>


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
          // A Apple exige exibir o preço praticado pela loja. Quando o app
          // consegue ler o preço real, ele tem prioridade sobre o configurado.
          const monthlyLabel =
            monthlyProduct?.priceSource === "store"
              ? monthlyProduct.priceString
              : formatCentavos(plan.price_monthly);
          const yearlyCents =
            plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12;
          const yearlyLabel =
            yearlyProduct?.priceSource === "store"
              ? yearlyProduct.priceString
              : formatCentavos(yearlyCents);

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
                    const hasDiscount = yearlyCents < plan.price_monthly * 12;
                    return (
                      <div className="space-y-1">
                        <div>
                          <span className="text-3xl font-bold text-foreground">
                            {monthlyLabel}
                          </span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                        <div>
                          <span className="text-lg font-semibold text-muted-foreground">
                            {yearlyLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">/ano</span>
                          {hasDiscount && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {Math.round(
                                (1 - yearlyCents / (plan.price_monthly * 12)) * 100
                              )}
                              % off
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Assinatura com renovação automática. Cancele quando quiser.
                        </p>
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
                        disabled={purchasingThis || (!isWeb && !monthlyProduct)}
                      >
                        {purchasing === monthlyProduct?.productId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Assinar mensal — {monthlyLabel}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSubscribe(plan, "yearly")}
                        disabled={purchasingThis || (!isWeb && !yearlyProduct)}
                      >
                        {purchasing === yearlyProduct?.productId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Assinar anual — {yearlyLabel}
                      </Button>

                      {isWeb && (
                        <div className="pt-2 space-y-2">
                          <p className="text-[11px] text-muted-foreground text-center">
                            ou pague por Pix (liberação automática)
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSubscribe(plan, "monthly", "pix")}
                              disabled={!!purchasing}
                            >
                              {purchasing === `pix:${plan.id}:monthly` ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <QrCode className="w-4 h-4 mr-2" />
                              )}
                              Pix mensal
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSubscribe(plan, "yearly", "pix")}
                              disabled={!!purchasing}
                            >
                              {purchasing === `pix:${plan.id}:yearly` ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <QrCode className="w-4 h-4 mr-2" />
                              )}
                              Pix anual
                            </Button>
                          </div>
                        </div>
                      )}
                    </>


                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasActiveSub && !isWeb && (
        <Card className="card-glass">
          <CardContent className="pt-6 text-xs text-muted-foreground">
            Para alterar forma de pagamento, cancelar ou ver histórico de cobranças,
            acesse os ajustes de assinaturas da sua conta no dispositivo.
          </CardContent>
        </Card>
      )}

      {/* Informações obrigatórias de assinatura */}
      <Card className="card-glass">
        <CardContent className="pt-6 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Sobre as assinaturas</p>
          <p>
            As assinaturas Pro e Premium são mensais ou anuais e renovam
            automaticamente ao final de cada período, salvo cancelamento com
            pelo menos 24 horas de antecedência.
          </p>
          <p>
            A cobrança acontece na confirmação da compra e a cada renovação.
            Você pode gerenciar ou cancelar sua assinatura a qualquer momento.
          </p>
          {isWeb && (
            <p>
              No pagamento por Pix não há renovação automática: o acesso é
              liberado assim que o Pix é identificado e vale por 30 dias (mensal)
              ou 12 meses (anual). Perto do vencimento basta pagar um novo Pix.
            </p>
          )}
          <div className="flex flex-wrap gap-4 pt-1">
            <a href="/politica-de-privacidade" className="underline">
              Política de Privacidade
            </a>
            <a href="/suporte" className="underline">
              Termos de Uso e Suporte
            </a>
            {!isWeb && (
              <button type="button" onClick={handleRestore} className="underline">
                Restaurar compras
              </button>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );

}
