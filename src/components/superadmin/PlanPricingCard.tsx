import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DollarSign, Save } from "lucide-react";
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface PricingRow {
  id: string;
  plan: string;
  billing_cycle: string;
  price: number;
}

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

  const planLabel = (plan: string) => (plan === "pro" ? "Pro" : "Premium");
  const cycleLabel = (cycle: string) => (cycle === "monthly" ? "Mensal" : "Anual");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preços dos Planos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const grouped = {
    pro: pricing?.filter((p) => p.plan === "pro") || [],
    premium: pricing?.filter((p) => p.plan === "premium") || [],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Preços dos Planos
        </CardTitle>
        <CardDescription>
          Defina os valores mensais e anuais para cada plano. O plano Free é sempre gratuito.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Free plan info */}
        <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
          <p className="font-medium text-foreground">Free</p>
          <p className="text-sm text-muted-foreground">Sempre gratuito — R$ 0,00</p>
        </div>

        {(["pro", "premium"] as const).map((plan) => (
          <div key={plan} className="space-y-3">
            <p className="font-semibold text-foreground">{planLabel(plan)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {grouped[plan].map((row) => {
                const key = `${row.plan}-${row.billing_cycle}`;
                return (
                  <div key={row.id} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">{cycleLabel(row.billing_cycle)}</Label>
                      <Input
                        value={getValue(row)}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder="R$ 0,00"
                        className="h-9 text-sm lowercase"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      disabled={editValues[key] === undefined || updateMutation.isPending}
                      onClick={() => handleSave(row)}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
