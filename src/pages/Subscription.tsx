import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, CheckCircle2, Clock, Copy, Crown, ExternalLink, Loader2, MapPin, QrCode, RefreshCw, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { maskCPF, maskPhone, maskCEP } from "@/lib/masks";
import { fetchAddressByCep } from "@/lib/address";

type BillingType = "monthly" | "yearly";

interface CustomerData {
  phone: string;
  cpf: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

const EMPTY_CUSTOMER: CustomerData = {
  phone: "",
  cpf: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipcode: "",
};

function isCustomerComplete(c: CustomerData): boolean {
  const digits = (v: string) => v.replace(/\D/g, "");
  return (
    digits(c.phone).length >= 10 &&
    digits(c.cpf).length === 11 &&
    !!c.street.trim() &&
    !!c.number.trim() &&
    !!c.neighborhood.trim() &&
    !!c.city.trim() &&
    c.state.replace(/\s/g, "").length === 2 &&
    digits(c.zipcode).length === 8
  );
}

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

interface PaymentResult {
  qr_code_base64: string | null;
  pix_code: string | null;
  checkout_url: string | null;
  order_nsu: string;
  created_at: string;
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
  const {
    plan: effectivePlan,
    originalPlan,
    isSubscriptionExpired,
    isSubscriptionPending,
    subscriptionEndDate,
    isLoading: planLoading,
  } = usePlanLimits();

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState("");
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData>(EMPTY_CUSTOMER);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ plan_id: string; billing_type: BillingType } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  

  const handleCepBlur = async () => {
    const clean = customerData.zipcode.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    const addr = await fetchAddressByCep(clean);
    setCepLoading(false);
    if (addr) {
      setCustomerData((prev) => ({
        ...prev,
        street: addr.street || prev.street,
        neighborhood: addr.neighborhood || prev.neighborhood,
        city: addr.city || prev.city,
        state: addr.state || prev.state,
      }));
    }
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Poll payment status every 5 seconds when dialog is open
  useEffect(() => {
    if (!paymentDialog || !paymentResult?.order_nsu || paymentConfirmed) {
      stopPolling();
      return;
    }

    const checkStatus = async () => {
      const { data, error } = await supabase
        .from("plan_payments")
        .select("status")
        .eq("order_nsu", paymentResult.order_nsu)
        .maybeSingle();

      if (!error && data?.status === "paid") {
        setPaymentConfirmed(true);
        stopPolling();
        toast.success("Pagamento confirmado! Seu plano foi ativado.");
        // Refresh all relevant queries
        queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["org-plan"] });
        queryClient.invalidateQueries({ queryKey: ["active-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
      }
    };

    // Check immediately, then every 5s
    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);

    return () => stopPolling();
  }, [paymentDialog, paymentResult?.order_nsu, paymentConfirmed, stopPolling, queryClient]);

  // Reset confirmed state when dialog closes
  const handleDialogClose = (open: boolean) => {
    setPaymentDialog(open);
    if (!open) {
      stopPolling();
      if (paymentConfirmed) {
        setPaymentResult(null);
        setPaymentConfirmed(false);
      }
    }
  };

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

  const payMutation = useMutation({
    mutationFn: async ({
      plan_id,
      billing_type,
      customer,
      address,
    }: {
      plan_id: string;
      billing_type: BillingType;
      customer?: Record<string, string>;
      address?: Record<string, string>;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "create-pix-payment-for-plan",
        {
          body: { plan_id, billing_type, customer, address },
        }
      );
      if (error) {
        // Try to parse the error response for missing_fields
        throw error;
      }
      if (data?.error) {
        const err: any = new Error(data.error);
        err.missing_fields = data.missing_fields;
        throw err;
      }
      return data as PaymentResult;
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      setShowCustomerForm(false);
      setPendingPlan(null);
      // If we only have checkout_url (no direct pix data), open externally
      if (!data.qr_code_base64 && !data.pix_code && data.checkout_url) {
        window.open(data.checkout_url, '_blank');
        setPaymentDialog(true);
      } else {
        setPaymentDialog(true);
      }
    },
    onError: (err: any) => {
      if (err?.missing_fields?.length > 0) {
        setShowCustomerForm(true);
        toast.info("Preencha seus dados para gerar o Pix");
      } else {
        toast.error(err?.message || "Erro ao gerar pagamento");
      }
    },
  });

  const handleSubscribe = (plan: PlatformPlan, billingType: BillingType) => {
    setSelectedPlanName(plan.name);
    const digits = (v: string) => v.replace(/\D/g, "");
    if (isCustomerComplete(customerData)) {
      payMutation.mutate({
        plan_id: plan.id,
        billing_type: billingType,
        customer: {
          phone_number: digits(customerData.phone),
          document: digits(customerData.cpf),
        },
        address: {
          street: customerData.street.trim(),
          number: customerData.number.trim(),
          complement: customerData.complement.trim(),
          neighborhood: customerData.neighborhood.trim(),
          city: customerData.city.trim(),
          state: customerData.state.trim().toUpperCase(),
          zipcode: digits(customerData.zipcode),
        },
      });
    } else {
      setPendingPlan({ plan_id: plan.id, billing_type: billingType });
      setShowCustomerForm(true);
      toast.info("Preencha seus dados para gerar o Pix");
    }
  };

  const handleSubmitCustomerForm = () => {
    if (!pendingPlan) return;
    if (!isCustomerComplete(customerData)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const digits = (v: string) => v.replace(/\D/g, "");
    payMutation.mutate({
      plan_id: pendingPlan.plan_id,
      billing_type: pendingPlan.billing_type,
      customer: {
        phone_number: digits(customerData.phone),
        document: digits(customerData.cpf),
      },
      address: {
        street: customerData.street.trim(),
        number: customerData.number.trim(),
        complement: customerData.complement.trim(),
        neighborhood: customerData.neighborhood.trim(),
        city: customerData.city.trim(),
        state: customerData.state.trim().toUpperCase(),
        zipcode: digits(customerData.zipcode),
      },
    });
  };

  const handleActivateFree = async () => {
    // For free plan, just update the org directly - no payment needed
    toast.success("Plano gratuito ativado!");
  };

  const handleCopyPix = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleManualCheck = async () => {
    if (!paymentResult?.order_nsu) return;
    setManualChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { order_nsu: paymentResult.order_nsu },
      });
      if (error) throw error;
      if (data?.paid) {
        setPaymentConfirmed(true);
        stopPolling();
        toast.success("Pagamento confirmado! Seu plano foi ativado.");
        queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["org-plan"] });
        queryClient.invalidateQueries({ queryKey: ["active-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      }
    } catch {
      toast.error("Erro ao verificar pagamento.");
    } finally {
      setManualChecking(false);
    }
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
                    variant={
                      activeSubscription.status === "active"
                        ? "default"
                        : "secondary"
                    }
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
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrentPlan =
            plan.plan === currentPlanSlug && !isSubscriptionExpired;
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
                              {Math.round(
                                (1 - yearly / (plan.price_monthly * 12)) * 100
                              )}% off
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
                      {isCurrentPlan
                        ? "Plano atual"
                        : "Ativar plano gratuito"}
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
                        disabled={payMutation.isPending}
                      >
                        {payMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Assinar mensal — {formatCentavos(plan.price_monthly)}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSubscribe(plan, "yearly")}
                        disabled={payMutation.isPending}
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

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {paymentConfirmed ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <QrCode className="w-5 h-5" />
              )}
              {paymentConfirmed
                ? "Pagamento confirmado!"
                : `Pagamento Pix — ${selectedPlanName}`}
            </DialogTitle>
          </DialogHeader>

          {paymentConfirmed ? (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Pagamento confirmado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Seu plano {selectedPlanName} foi ativado com sucesso.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleDialogClose(false)}
              >
                Fechar
              </Button>
            </div>
          ) : paymentResult ? (
            <div className="space-y-4">
              {/* Payment instructions */}
              <p className="text-sm text-center text-muted-foreground">
                {paymentResult.qr_code_base64 || paymentResult.pix_code
                  ? "Escaneie o QR Code com seu app de banco ou use o código Pix abaixo."
                  : "A InfinitePay abriu esta cobrança em uma página segura. Use o botão abaixo para concluir o pagamento Pix."}
              </p>

              {/* Real Pix QR only */}
              {paymentResult.qr_code_base64 ? (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={
                      paymentResult.qr_code_base64.startsWith("data:")
                        ? paymentResult.qr_code_base64
                        : `data:image/png;base64,${paymentResult.qr_code_base64}`
                    }
                    alt="QR Code Pix"
                    className="w-56 h-56"
                  />
                </div>
              ) : paymentResult.pix_code ? (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={paymentResult.pix_code}
                    size={224}
                    level="M"
                    includeMargin
                  />
                </div>
              ) : paymentResult.checkout_url ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Clique abaixo para visualizar o QR Code Pix na página segura da InfinitePay.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => window.open(paymentResult.checkout_url!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir Checkout Pix
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-destructive">
                    Erro ao gerar QR Code. Tente novamente.
                  </p>
                </div>
              )}


              {/* Pix Code copy-paste */}
              {paymentResult.pix_code && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Código Pix copia e cola:
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-muted p-3 rounded-md break-all max-h-20 overflow-y-auto">
                      {paymentResult.pix_code}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleCopyPix(paymentResult.pix_code!)}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Status + timestamp */}
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <Badge variant="secondary">
                    {paymentResult.created_at && Date.now() - new Date(paymentResult.created_at).getTime() > 15 * 60 * 1000
                      ? "Cobrança expirada"
                      : "Aguardando pagamento"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verificando automaticamente a cada 5 segundos...
                </p>
                {paymentResult.created_at && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    Gerado em {new Date(paymentResult.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {/* Fallback buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleManualCheck}
                  disabled={manualChecking}
                >
                  {manualChecking ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Já paguei
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Gerar novo pagamento"
                  onClick={() => {
                    setPaymentResult(null);
                    setPaymentConfirmed(false);
                    stopPolling();
                    payMutation.mutate({
                      plan_id: plans?.find((p) => p.name === selectedPlanName)?.id || "",
                      billing_type: "monthly",
                    });
                  }}
                  disabled={payMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 ${payMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {/* Order ref */}
              <p className="text-xs text-muted-foreground text-center">
                Ref: {paymentResult.order_nsu}
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Data Dialog – InfinitePay-style checkout */}
      <Dialog open={showCustomerForm} onOpenChange={(open) => { setShowCustomerForm(open); if (!open) { setPendingPlan(null); setCheckoutStep("contact"); } }}>
        <DialogContent className="p-0 gap-0 max-w-md max-h-[95vh] overflow-hidden rounded-2xl border-0">
          {/* Resumo da compra header */}
          {pendingPlan && (() => {
            const plan = plans?.find(p => p.id === pendingPlan.plan_id);
            if (!plan) return null;
            const price = pendingPlan.billing_type === "yearly"
              ? (plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12)
              : plan.price_monthly;
            return (
              <div className="bg-muted/60 px-5 py-4 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Resumo da compra</span>
                </div>
                <span className="text-base font-bold text-foreground">{formatCentavos(price)}</span>
              </div>
            );
          })()}

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 px-5 pt-4 pb-2 text-xs text-muted-foreground">
            <span className={checkoutStep === "contact" ? "text-foreground font-semibold" : ""}>Contato</span>
            <span className="text-muted-foreground/40">›</span>
            <span className={checkoutStep === "address" ? "text-foreground font-semibold" : ""}>Endereço</span>
            <span className="text-muted-foreground/40">›</span>
            <span className="text-muted-foreground/40">Pagamento</span>
          </div>

          <div className="px-5 pb-5 pt-2 overflow-y-auto max-h-[70vh]">
            {checkoutStep === "contact" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Contato</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <Input
                        mask="phone"
                        placeholder="(00) 00000-0000"
                        value={customerData.phone}
                        onChange={(e) => setCustomerData((p) => ({ ...p, phone: e.target.value }))}
                        maxLength={15}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">CPF</Label>
                      <Input
                        mask="cpf"
                        placeholder="000.000.000-00"
                        value={customerData.cpf}
                        onChange={(e) => setCustomerData((p) => ({ ...p, cpf: e.target.value }))}
                        maxLength={14}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={() => {
                    const digits = (v: string) => v.replace(/\D/g, "");
                    if (digits(customerData.phone).length < 10) {
                      toast.error("Informe um telefone válido");
                      return;
                    }
                    if (digits(customerData.cpf).length !== 11) {
                      toast.error("Informe um CPF válido");
                      return;
                    }
                    setCheckoutStep("address");
                  }}
                >
                  Continuar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Endereço</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <Input
                        mask="cep"
                        placeholder="00000-000"
                        value={customerData.zipcode}
                        onChange={(e) => setCustomerData((p) => ({ ...p, zipcode: e.target.value }))}
                        onBlur={handleCepBlur}
                        maxLength={9}
                        className="h-11"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Rua</Label>
                        <Input
                          placeholder={cepLoading ? "Buscando..." : "Rua / Av"}
                          value={customerData.street}
                          onChange={(e) => setCustomerData((p) => ({ ...p, street: e.target.value }))}
                          disabled={cepLoading}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Nº</Label>
                        <Input
                          placeholder="123"
                          value={customerData.number}
                          onChange={(e) => setCustomerData((p) => ({ ...p, number: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Complemento</Label>
                      <Input
                        placeholder="Apto / Sala (opcional)"
                        value={customerData.complement}
                        onChange={(e) => setCustomerData((p) => ({ ...p, complement: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <Input
                        placeholder="Bairro"
                        value={customerData.neighborhood}
                        onChange={(e) => setCustomerData((p) => ({ ...p, neighborhood: e.target.value }))}
                        disabled={cepLoading}
                        className="h-11"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Cidade</Label>
                        <Input
                          placeholder="Cidade"
                          value={customerData.city}
                          onChange={(e) => setCustomerData((p) => ({ ...p, city: e.target.value }))}
                          disabled={cepLoading}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">UF</Label>
                        <Input
                          placeholder="SP"
                          value={customerData.state}
                          onChange={(e) => setCustomerData((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                          maxLength={2}
                          disabled={cepLoading}
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl"
                    onClick={() => setCheckoutStep("contact")}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl"
                    onClick={handleSubmitCustomerForm}
                    disabled={payMutation.isPending || !isCustomerComplete(customerData)}
                  >
                    {payMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Pagar com Pix
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
