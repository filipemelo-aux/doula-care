import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DollarSign, Save, Sparkles, Crown } from "lucide-react";
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface PricingRow {
  id: string;
  plan: string;
  billing_cycle: string;
  price: number;
}

const planConfig: Record<string, { label: string; icon: React.ReactNode; badgeClass: string; gradientClass: string }> = {
  pro: {
    label: "Pro",
    icon: <Sparkles className="h-5 w-5 text-primary" />,
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    gradientClass: "from-primary/20 to-accent/20",
  },
  premium: {
    label: "Premium",
    icon: <Crown className="h-5 w-5 text-amber-600" />,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300/30",
    gradientClass: "from-amber-200/50 to-amber-100/30 dark:from-amber-900/20 dark:to-amber-800/10",
  },
};

export function PlanPricingCard() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const { data: pricing, isLoading } = useQuery({
    queryKey: ["platform-plan-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_pricing")
        .select("*")
        .eq("is_active", true)
        .order("plan")
        .order("billing_cycle");
      if (error) throw error;
      return data as PricingRow[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await supabase
        .from("platform_plan_pricing")
        .update({ price })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plan-pricing"] });
      toast.success("Preço atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar preço"),
  });

  const handleSave = (row: PricingRow) => {
    const key = `${row.plan}-${row.billing_cycle}`;
    const rawValue = editValues[key];
    if (rawValue === undefined) return;
    const price = parseCurrency(rawValue);
    updateMutation.mutate({ id: row.id, price });
  };

  const getValue = (row: PricingRow) => {
    const key = `${row.plan}-${row.billing_cycle}`;
    if (editValues[key] !== undefined) return editValues[key];
    return maskCurrency(String(row.price * 100));
  };

  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: maskCurrency(value) }));
  };

  const cycleLabel = (cycle: string) => (cycle === "monthly" ? "Mensal" : "Anual");

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Preços dos Planos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const grouped = {
    pro: pricing?.filter((p) => p.plan === "pro") || [],
    premium: pricing?.filter((p) => p.plan === "premium") || [],
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        Preços dos Planos
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Free card */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground">Free</h3>
                  <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">
                    Gratuito
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Sempre gratuito</p>
                <p className="text-lg font-bold text-foreground mt-1">R$ 0,00</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pro & Premium cards */}
        {(["pro", "premium"] as const).map((plan) => {
          const config = planConfig[plan];
          return (
            <Card key={plan} className="group hover:shadow-md transition-all duration-200 border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${config.gradientClass} flex items-center justify-center`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{config.label}</h3>
                      <Badge variant="outline" className={`text-[10px] h-5 ${config.badgeClass}`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                  {grouped[plan].map((row) => {
                    const key = `${row.plan}-${row.billing_cycle}`;
                    return (
                      <div key={row.id} className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-14 flex-shrink-0">
                          {cycleLabel(row.billing_cycle)}
                        </Label>
                        <Input
                          value={getValue(row)}
                          onChange={(e) => handleChange(key, e.target.value)}
                          placeholder="R$ 0,00"
                          className="h-8 text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          disabled={editValues[key] === undefined || updateMutation.isPending}
                          onClick={() => handleSave(row)}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
