import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Loader2, CheckCircle, Clock, Sparkles, X, Crown, Check } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export function PromoBetaBanner() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  const dismissKey = `promo_banner_dismissed_${organizationId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "true"; } catch { return false; }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, "true"); } catch {}
  };

  const { data: promo } = useQuery({
    queryKey: ["my-org-promo", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .in("promotion_type", ["beta_tester", "lifetime_premium"])
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_pricing")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: planLimits } = useQuery({
    queryKey: ["platform-plan-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const choosePlanMutation = useMutation({
    mutationFn: async (plan: string) => {
      if (!promo || !organizationId) throw new Error("Promoção não encontrada");

      // Save chosen plan in promo record
      const { error } = await supabase
        .from("org_promotions" as any)
        .update({
          chosen_plan: plan,
          status: "completed",
        } as any)
        .eq("id", promo.id);
      if (error) throw error;

      // Downgrade org to free (trial ended)
      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "free" as any })
        .eq("id", organizationId);
      if (orgError) throw orgError;

      // Send notification
      await supabase.from("org_notifications").insert({
        organization_id: organizationId,
        title: "📋 Plano escolhido!",
        message: `Você escolheu o plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}. Nosso time entrará em contato para ativar sua assinatura.`,
        type: "promotion",
      });
    },
    onSuccess: (_, plan) => {
      queryClient.invalidateQueries({ queryKey: ["my-org-promo", organizationId] });
      setPlanDialogOpen(false);
      toast.success(`Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)} selecionado! Entraremos em contato.`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const activateLifetimeMutation = useMutation({
    mutationFn: async () => {
      if (!promo || !organizationId) throw new Error("Promoção não encontrada");
      const now = new Date();

      const { error } = await supabase
        .from("org_promotions" as any)
        .update({
          status: "lifetime_active",
          bonus_chosen_at: now.toISOString(),
          bonus_started_at: now.toISOString(),
        } as any)
        .eq("id", promo.id);
      if (error) throw error;

      await supabase.from("org_notifications").insert({
        organization_id: organizationId,
        title: "👑 Surpresa: Acesso Vitalício Premium!",
        message: "Parabéns! Como reconhecimento especial pela sua contribuição, você ganhou acesso VITALÍCIO ao plano Premium. Aproveite todos os recursos sem limite de tempo!",
        type: "promotion",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-org-promo", organizationId] });
      setPlanDialogOpen(false);
      toast.success("Acesso vitalício Premium ativado! 👑");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (!promo) return null;
  if (promo.status === "completed") return null;

  const isLifetime = promo.promotion_type === "lifetime_premium";
  const trialEndsAt = promo.trial_ends_at ? new Date(promo.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, now)) : 0;
  const isTrialExpired = trialEndsAt && now >= trialEndsAt;

  // Don't allow dismiss if trial is expired (force visibility)
  if (dismissed && !isTrialExpired) return null;

  const isLifetime = promo.promotion_type === "lifetime_premium";
  const trialEndsAt = promo.trial_ends_at ? new Date(promo.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, now)) : 0;
  const isTrialExpired = trialEndsAt && now >= trialEndsAt;
  const showChoiceButton = promo.status === "trial_active" || promo.status === "awaiting_choice";

  // Lifetime active — permanent banner
  if (promo.status === "lifetime_active") {
    return (
      <Alert className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 relative pr-8">
        <Crown className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold flex items-center gap-2">
          Premium Vitalício
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
          Você tem acesso vitalício ao plano Premium como reconhecimento especial. Aproveite!
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-amber-600 hover:text-amber-800 hover:bg-amber-200/50"
          onClick={handleDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </Alert>
    );
  }

  // Trial active banner
  if (promo.status === "trial_active" && !isTrialExpired) {
    return (
      <Alert className="border-none bg-gradient-to-r from-primary/5 to-accent/5 relative pr-16">
        <Gift className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Teste Premium Gratuito
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Você está aproveitando o plano Premium gratuitamente!{" "}
          <strong className="text-foreground">{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</strong>.
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleDismiss}
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </Alert>
    );
  }

  // Trial expired
  if (showChoiceButton && isTrialExpired) {
    if (isLifetime) {
      // Lifetime reveal
      return (
        <>
          <Alert className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
            <Crown className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Seu período de teste terminou — mas temos uma surpresa!
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
              Toque no botão para descobrir seu presente exclusivo.
              <Button
                variant="default"
                size="sm"
                className="ml-2 h-7 text-xs bg-amber-500 hover:bg-amber-600"
                onClick={() => setPlanDialogOpen(true)}
              >
                <Gift className="h-3 w-3 mr-1" />
                Revelar Surpresa
              </Button>
            </AlertDescription>
          </Alert>
          <LifetimeRevealDialog
            open={planDialogOpen}
            onOpenChange={setPlanDialogOpen}
            onActivate={() => activateLifetimeMutation.mutate()}
            isPending={activateLifetimeMutation.isPending}
          />
        </>
      );
    }

    // Normal trial expired — show plan selection
    return (
      <>
        <Alert className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
            Seu teste Premium expirou!
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
            Escolha um plano para continuar utilizando os recursos.
            <Button
              variant="default"
              size="sm"
              className="ml-2 h-7 text-xs"
              onClick={() => setPlanDialogOpen(true)}
            >
              <Gift className="h-3 w-3 mr-1" />
              Ver Planos
            </Button>
          </AlertDescription>
        </Alert>
        <PlanSelectionDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          onChoose={(plan) => choosePlanMutation.mutate(plan)}
          isPending={choosePlanMutation.isPending}
          pricing={pricing || []}
          planLimits={planLimits || []}
        />
      </>
    );
  }

  return null;
}

function PlanSelectionDialog({
  open,
  onOpenChange,
  onChoose,
  isPending,
  pricing,
  planLimits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (plan: string) => void;
  isPending: boolean;
  pricing: any[];
  planLimits: any[];
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const plans = ["free", "pro", "premium"];
  const planLabels: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };
  const planColors: Record<string, string> = {
    free: "border-muted",
    pro: "border-primary/40 hover:border-primary",
    premium: "border-amber-400/40 hover:border-amber-500",
  };
  const planIconColors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-primary/10 text-primary",
    premium: "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  };

  const getLimits = (plan: string) => planLimits.find((l) => l.plan === plan);

  const getMonthlyPrice = (plan: string) => {
    const p = pricing.find((pr) => pr.plan === plan && pr.billing_cycle === "monthly");
    return p ? p.price : 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Escolha seu Plano
          </DialogTitle>
          <DialogDescription>
            Seu período de teste terminou. Selecione o plano ideal para você continuar usando o Doula Care.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {plans.map((plan) => {
            const limits = getLimits(plan);
            const monthlyPrice = getMonthlyPrice(plan);

            return (
              <Card
                key={plan}
                className={`cursor-pointer transition-all group ${planColors[plan]} hover:shadow-md`}
                onClick={() => !isPending && onChoose(plan)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${planIconColors[plan]}`}>
                      {plan === "premium" ? (
                        <Crown className="h-5 w-5" />
                      ) : plan === "pro" ? (
                        <Sparkles className="h-5 w-5" />
                      ) : (
                        <CheckCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-foreground">{planLabels[plan]}</h3>
                        <span className="text-sm font-bold text-foreground">
                          {monthlyPrice === 0 ? "Grátis" : `${formatCurrency(monthlyPrice)}/mês`}
                        </span>
                      </div>
                      {limits && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {limits.max_clients ? `Até ${limits.max_clients} gestantes` : "Gestantes ilimitadas"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {limits.agenda && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Agenda
                              </span>
                            )}
                            {limits.financial && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Financeiro
                              </span>
                            )}
                            {limits.messages && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Mensagens
                              </span>
                            )}
                            {limits.reports && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Relatórios
                              </span>
                            )}
                            {limits.push_notifications && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Push
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LifetimeRevealDialog({
  open,
  onOpenChange,
  onActivate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-amber-600">
            <Crown className="h-6 w-6" />
            Surpresa Especial!
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p className="text-base">
              Como reconhecimento especial, queremos te presentear com algo único:
            </p>
            <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-6">
              <Crown className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">
                Acesso Vitalício Premium
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">
                Todos os recursos Premium, para sempre. Sem cobranças, sem limites de tempo.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={onActivate}
          disabled={isPending}
          className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Crown className="h-4 w-4 mr-2" />
          )}
          Ativar meu Acesso Vitalício!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
