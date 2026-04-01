import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Medal, Award } from "lucide-react";

export function TopPlansCard() {
  const { data: planStats, isLoading } = useQuery({
    queryKey: ["top-plans"],
    queryFn: async () => {
      const [clientsResult, plansResult] = await Promise.all([
        supabase.from("clients").select("plan, plan_value, plan_setting_id"),
        supabase.from("plan_settings").select("*").eq("is_active", true),
      ]);

      const clients = clientsResult.data || [];
      const plans = plansResult.data || [];

      // Build a map of plan_setting_id -> plan info
      const planById: Record<string, { name: string; planType: string }> = {};
      plans.forEach((plan) => {
        planById[plan.id] = { name: plan.name, planType: plan.plan_type };
      });

      // Group clients by their specific plan_setting_id, or by plan enum for unlinked clients
      const planData: Record<string, { count: number; revenue: number; name: string }> = {};

      // Always include "avulso"
      planData["_avulso"] = { count: 0, revenue: 0, name: "Avulso" };

      clients.forEach((client) => {
        // If client has a specific plan_setting_id that exists, group by it
        if (client.plan_setting_id && planById[client.plan_setting_id]) {
          const key = client.plan_setting_id;
          if (!planData[key]) {
            planData[key] = {
              count: 0,
              revenue: 0,
              name: planById[client.plan_setting_id].name,
            };
          }
          planData[key].count++;
          planData[key].revenue += Number(client.plan_value) || 0;
        } else if (client.plan === "avulso") {
          planData["_avulso"].count++;
          planData["_avulso"].revenue += Number(client.plan_value) || 0;
        } else {
          // Fallback: group by plan enum for clients without plan_setting_id
          const key = `_enum_${client.plan}`;
          if (!planData[key]) {
            planData[key] = {
              count: 0,
              revenue: 0,
              name: client.plan.charAt(0).toUpperCase() + client.plan.slice(1),
            };
          }
          planData[key].count++;
          planData[key].revenue += Number(client.plan_value) || 0;
        }
      });

      return Object.entries(planData)
        .map(([key, data]) => ({
          type: key,
          ...data,
        }))
        .filter((p) => p.count > 0 || p.type === "_avulso")
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
