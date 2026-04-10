import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanLimits } from "@/hooks/usePlanLimits";

export function ExpiredPlanBanner() {
  const { isSubscriptionExpired, originalPlan } = usePlanLimits();
  const navigate = useNavigate();

  if (!isSubscriptionExpired) return null;

  const planLabel = originalPlan === "pro" ? "Pro" : originalPlan === "premium" ? "Premium" : "Plano";

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
