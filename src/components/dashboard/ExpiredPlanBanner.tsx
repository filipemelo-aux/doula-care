import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Ban, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlanLimits } from "@/hooks/usePlanLimits";

export function ExpiredPlanBanner() {
  const {
    isSubscriptionExpired,
    isSubscriptionPending,
    isBlocked,
    isGracePeriod,
    isTrialExpired,
    hasActiveSubscription,
    daysOverdue,
    originalPlan,
  } = usePlanLimits();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-redirect to subscription page when trial expired without subscription
  // (only if not already on subscription or plans page)
  const shouldForceRedirect =
    isTrialExpired &&
    !hasActiveSubscription &&
    !location.pathname.includes("/admin/assinatura") &&
    !location.pathname.includes("/admin/planos");

  useEffect(() => {
    if (shouldForceRedirect) {
      navigate("/admin/assinatura", { replace: true });
    }
  }, [shouldForceRedirect, navigate]);

  // Super admins never see this banner (already handled by usePlanLimits, but double-safe)

  // Trial expired banner (takes priority)
  if (isTrialExpired && !hasActiveSubscription) {
    return (
      <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
        <Clock className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-sm font-semibold">
          Seu período de teste expirou!
        </AlertTitle>
        <AlertDescription className="text-xs flex items-center justify-between gap-4">
          <span>
            Seu trial Premium terminou. Assine um plano para continuar utilizando todos os recursos.
            Enquanto isso, os limites do plano Free estão sendo aplicados.
          </span>
          <Button
            size="sm"
            className="shrink-0 text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => navigate("/admin/assinatura")}
          >
            Assinar agora
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isSubscriptionExpired && !isBlocked) return null;

  const planLabel =
    originalPlan === "pro" ? "Pro" : originalPlan === "premium" ? "Premium" : "Plano";

  // Blocked state (after 3 days)
  if (isBlocked) {
    return (
      <Alert variant="destructive" className="bg-destructive/15 border-destructive/40">
        <Ban className="h-4 w-4" />
        <AlertTitle className="text-sm font-semibold">
          Acesso bloqueado
        </AlertTitle>
        <AlertDescription className="text-xs flex items-center justify-between gap-4">
          <span>
            Seu plano {planLabel} expirou há mais de 3 dias e o acesso premium foi bloqueado.
            Regularize o pagamento para reativar seus recursos.
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="shrink-0 text-xs h-7"
            onClick={() => navigate("/admin/planos")}
          >
            Regularizar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Grace period (pending, within 3 days)
  if (isGracePeriod) {
    const remainingDays = Math.max(0, 3 - daysOverdue);
    return (
      <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-sm font-semibold">
          Assinatura vencida — {remainingDays} dia{remainingDays !== 1 ? "s" : ""} restante{remainingDays !== 1 ? "s" : ""}
        </AlertTitle>
        <AlertDescription className="text-xs flex items-center justify-between gap-4">
          <span>
            Sua assinatura venceu. Realize o pagamento para continuar utilizando os recursos premium.
            Após 3 dias o acesso será bloqueado.
          </span>
          <Button
            size="sm"
            className="shrink-0 text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => navigate("/admin/planos")}
          >
            Pagar agora
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Generic expired
  return (
    <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">
        Plano {planLabel} expirado
      </AlertTitle>
      <AlertDescription className="text-xs flex items-center justify-between gap-4">
        <span>
          Seu plano expirou. Regularize o pagamento para continuar utilizando os recursos premium.
          Enquanto isso, os limites do plano Free estão sendo aplicados.
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="shrink-0 text-xs h-7"
          onClick={() => navigate("/admin/planos")}
        >
          Renovar plano
        </Button>
      </AlertDescription>
    </Alert>
  );
}
