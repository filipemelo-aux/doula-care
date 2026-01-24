import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        }
      });

      return Object.entries(planData)
        .map(([type, data]) => ({
          type,
          ...data,
        }))
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
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Planos Mais Contratados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Planos Mais Contratados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {planStats && planStats.length > 0 ? (
          planStats.map((plan, index) => (
            <div
              key={plan.type}
              className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                index === 0
                  ? "bg-warning/5 border border-warning/20"
                  : "bg-muted/30 border border-border/50"
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
      </CardContent>
    </Card>
  );
}
