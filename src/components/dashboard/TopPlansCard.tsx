import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Medal, Award } from "lucide-react";

export function TopPlansCard() {
  const { data: planStats, isLoading } = useQuery({
    queryKey: ["top-plans"],
    queryFn: async () => {
      const [clientsResult, plansResult] = await Promise.all([
        supabase.from("clients").select("plan, plan_value"),
        supabase.from("plan_settings").select("*").eq("is_active", true),
      ]);

      const clients = clientsResult.data || [];
      const plans = plansResult.data || [];

      const planData: Record<string, { count: number; revenue: number; name: string }> = {};

      // Always include "avulso"
      planData["avulso"] = { count: 0, revenue: 0, name: "Avulso" };

      plans.forEach((plan) => {
        planData[plan.plan_type] = {
          count: 0,
          revenue: 0,
          name: plan.name,
        };
      });

      clients.forEach((client) => {
        if (planData[client.plan]) {
          planData[client.plan].count++;
          planData[client.plan].revenue += Number(client.plan_value) || 0;
        } else {
          // Plan type exists on client but not in plan_settings
          planData[client.plan] = {
            count: 1,
            revenue: Number(client.plan_value) || 0,
            name: client.plan.charAt(0).toUpperCase() + client.plan.slice(1),
          };
        }
      });

      return Object.entries(planData)
        .map(([type, data]) => ({
          type,
          ...data,
        }))
        .filter((p) => p.count > 0 || p.type === "avulso")
        .sort((a, b) => b.count - a.count);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-warning" />;
      case 1:
        return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 2:
        return <Award className="w-5 h-5 text-accent" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">Planos Mais Contratados</h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-semibold text-lg text-foreground">Planos Mais Contratados</h2>
      </div>
      <div className="space-y-3">
        {planStats && planStats.length > 0 ? (
          planStats.map((plan, index) => (
            <div
              key={plan.type}
              className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                index === 0
                  ? "bg-warning/5"
                  : "bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background">
                {getRankIcon(index)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {plan.count} cliente{plan.count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {formatCurrency(plan.revenue)}
                </p>
                <p className="text-xs text-muted-foreground">receita potencial</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum plano cadastrado
          </div>
        )}
      </div>
    </div>
  );
}
