import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Store, Save, Apple, Smartphone } from "lucide-react";

interface ProductRow {
  id: string;
  plan_id: string;
  platform: "ios" | "android";
  billing_period: "monthly" | "yearly";
  product_id: string;
  active: boolean;
  plan?: { plan: string; name: string };
}

const periodLabel: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
};

export function StoreProductsCard() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sa-store-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_store_products" as any)
        .select("*, plan:platform_plan_limits!inner(plan, name)")
        .order("platform");
      if (error) throw error;
      return (data as any[]) as ProductRow[];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductRow> }) => {
      const { error } = await supabase
        .from("plan_store_products" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      toast.success("Produto atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-xl" />;
  }

  const grouped = ["ios", "android"].map((platform) => ({
    platform,
    items: (rows || []).filter((r) => r.platform === platform),
  }));

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Store className="h-4 w-4 text-primary" />
        Produtos das Lojas (IAP)
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {grouped.map((group) => (
          <Card key={group.platform}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {group.platform === "ios" ? (
                  <Apple className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                <h3 className="text-sm font-semibold">
                  {group.platform === "ios" ? "App Store" : "Google Play"}
                </h3>
              </div>

              {group.items.map((row) => {
                const value = edits[row.id] ?? row.product_id;
                const dirty = edits[row.id] !== undefined && edits[row.id] !== row.product_id;
                return (
                  <div key={row.id} className="space-y-1.5 pt-2 border-t first:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">
                        {row.plan?.name} · {periodLabel[row.billing_period]}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {row.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Switch
                          checked={row.active}
                          onCheckedChange={(v) =>
                            mutation.mutate({ id: row.id, updates: { active: v } })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={value}
                        onChange={(e) =>
                          setEdits((p) => ({ ...p, [row.id]: e.target.value }))
                        }
                        className="h-8 text-sm font-mono"
                        placeholder="com.exemplo.produto"
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!dirty || mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            id: row.id,
                            updates: { product_id: edits[row.id].trim() },
                          })
                        }
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
