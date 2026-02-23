import { AlertTriangle, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrgPlan } from "@/hooks/usePlanLimits";

interface UpgradeBannerProps {
  feature: string;
  currentPlan: OrgPlan;
  requiredPlan?: "pro" | "premium";
}

export function UpgradeBanner({ feature, currentPlan, requiredPlan = "pro" }: UpgradeBannerProps) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {feature} disponível no plano{" "}
            <Badge variant="outline" className="ml-1 uppercase">
              {requiredPlan}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seu plano atual é <span className="font-medium uppercase">{currentPlan}</span>. 
            Entre em contato para fazer upgrade.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClientLimitBannerProps {
  remaining: number | null;
  max: number | null;
  current: number;
}

export function ClientLimitBanner({ remaining, max, current }: ClientLimitBannerProps) {
  if (remaining === null || max === null) return null;
  
  const isAtLimit = remaining <= 0;
  const isNearLimit = remaining <= 2 && remaining > 0;

  if (!isAtLimit && !isNearLimit) return null;

  return (
    <Card className={isAtLimit ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAtLimit ? "bg-destructive/15" : "bg-warning/15"}`}>
          <AlertTriangle className={`w-5 h-5 ${isAtLimit ? "text-destructive" : "text-warning"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isAtLimit
              ? `Limite de ${max} gestantes atingido`
              : `Restam apenas ${remaining} vagas de gestantes`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current}/{max} gestantes cadastradas. Faça upgrade para o plano Pro para cadastros ilimitados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
