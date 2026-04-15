import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Gift, Clock, Sparkles, X, Crown } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useState } from "react";

export function PromoBetaBanner() {
  const { organizationId } = useAuth();
  const navigate = useNavigate();

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
        .in("status", ["trial_active", "lifetime_active"])
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  if (!promo) return null;

  const trialEndsAt = promo.trial_ends_at ? new Date(promo.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, now)) : 0;
  const isTrialExpired = trialEndsAt && now >= trialEndsAt;

  // Don't allow dismiss if trial is expired
  if (dismissed && !isTrialExpired) return null;

  // Lifetime active — permanent banner
  if (promo.status === "lifetime_active") {
    return (
      <Alert className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 relative pr-8">
        <Crown className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold flex items-center gap-2">
          Premium Vitalício
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
          Você tem acesso vitalício ao plano Premium. Aproveite!
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

  // Trial active (not expired)
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

  // Trial expired — redirect to subscription page
  if (promo.status === "trial_active" && isTrialExpired) {
    return (
      <Alert className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
          Seu teste Premium expirou!
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
          Assine um plano para continuar utilizando os recursos premium.
          <Button
            variant="default"
            size="sm"
            className="ml-2 h-7 text-xs"
            onClick={() => navigate("/admin/assinatura")}
          >
            <Gift className="h-3 w-3 mr-1" />
            Assinar Plano
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}