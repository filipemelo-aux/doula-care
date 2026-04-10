import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Sparkles, Crown } from "lucide-react";

const planConfig: Record<string, { label: string; icon: React.ReactNode; badgeClass: string; gradientClass: string }> = {
  pro: {
    label: "Pro",
    icon: <Sparkles className="h-5 w-5 text-primary" />,
    badgeClass: "bg-primary/10 text-primary",
    gradientClass: "from-primary/20 to-accent/20",
  },
  premium: {
    label: "Premium",
    icon: <Crown className="h-5 w-5 text-amber-600" />,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    gradientClass: "from-amber-200/50 to-amber-100/30 dark:from-amber-900/20 dark:to-amber-800/10",
  },
};

const formatCurrency = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

export function PlanPricingCard() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["platform-plan-limits-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("id, plan, name, price_monthly, price_yearly, is_free")
        .order("plan");
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Preços dos Planos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const free = plans?.find((p) => p.plan === "free");
  const paid = plans?.filter((p) => !p.is_free) || [];

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        Preços dos Planos
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Free */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Free</h3>
              <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Gratuito</Badge>
            </div>
          </div>
          <p className="text-lg font-bold text-foreground mt-2">R$ 0,00</p>
        </div>

        {/* Paid plans */}
        {paid.map((plan) => {
          const config = planConfig[plan.plan];
          if (!config) return null;
          return (
            <div key={plan.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradientClass} flex items-center justify-center`}>
                  {config.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{config.label}</h3>
                  <Badge variant="outline" className={`text-[10px] h-5 ${config.badgeClass}`}>{config.label}</Badge>
                </div>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-sm text-muted-foreground">
                  Mensal: <span className="font-semibold text-foreground">{formatCurrency(plan.price_monthly)}</span>
                </p>
                {plan.price_yearly > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Anual: <span className="font-semibold text-foreground">{formatCurrency(plan.price_yearly)}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
