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
import { Settings2, Save, Sparkles, Crown, DollarSign, Infinity } from "lucide-react";

interface LimitsRow {
  id: string;
  plan: string;
  max_clients: number | null;
  reports: boolean;
  export_reports: boolean;
  push_notifications: boolean;
  multi_collaborators: boolean;
  max_collaborators: number;
  agenda: boolean;
  clients: boolean;
  financial: boolean;
  expenses: boolean;
  notifications: boolean;
  messages: boolean;
}

const planConfig: Record<string, { label: string; icon: React.ReactNode; badgeClass: string; gradientClass: string }> = {
  free: {
    label: "Free",
    icon: <DollarSign className="h-5 w-5 text-muted-foreground" />,
    badgeClass: "bg-muted text-muted-foreground",
    gradientClass: "from-muted/50 to-muted/30",
  },
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

export function PlanLimitsCard() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, Partial<LimitsRow>>>({});

  const { data: limits, isLoading } = useQuery({
    queryKey: ["platform-plan-limits-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("*")
        .order("plan");
      if (error) throw error;
      return (data as any[]) as LimitsRow[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LimitsRow> }) => {
      const { error } = await supabase
        .from("platform_plan_limits" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
      queryClient.invalidateQueries({ queryKey: ["platform-plan-limits-admin"] });
      toast.success("Limites atualizados!");
    },
    onError: () => toast.error("Erro ao atualizar limites"),
  });

  const getEditValue = (plan: string) => editValues[plan] || {};

  const handleSave = (row: LimitsRow) => {
    const edits = editValues[row.plan];
    if (!edits) return;
    const { id, plan, ...updates } = { ...edits } as any;
    updateMutation.mutate({ id: row.id, updates });
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[row.plan];
      return next;
    });
  };

  const setField = (plan: string, field: string, value: any) => {
    setEditValues((prev) => ({
      ...prev,
      [plan]: { ...prev[plan], [field]: value },
    }));
  };

  const getValue = (row: LimitsRow, field: keyof LimitsRow) => {
    const edit = editValues[row.plan];
    if (edit && field in edit) return (edit as any)[field];
    return row[field];
  };

  const hasChanges = (plan: string) => !!editValues[plan] && Object.keys(editValues[plan]).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Limites dos Planos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const orderedPlans = ["free", "pro", "premium"];
  const sortedLimits = orderedPlans
    .map((p) => limits?.find((l) => l.plan === p))
    .filter(Boolean) as LimitsRow[];

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        Limites dos Planos
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedLimits.map((row) => {
          const config = planConfig[row.plan];
          const maxClients = getValue(row, "max_clients") as number | null;
          const isUnlimited = maxClients === null;

          return (
            <Card key={row.id} className="group hover:shadow-md transition-all duration-200 border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${config.gradientClass} flex items-center justify-center`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{config.label}</h3>
                      <Badge variant="outline" className={`text-[10px] h-5 ${config.badgeClass}`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                  {/* Max gestantes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Máx. gestantes</Label>
                    <div className="flex items-center gap-2">
                      {isUnlimited ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1">
                          <Infinity className="h-4 w-4" />
                          <span>Ilimitado</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          value={maxClients ?? ""}
                          onChange={(e) => setField(row.plan, "max_clients", e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="h-8 text-sm flex-1"
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] px-2"
                        onClick={() =>
                          setField(row.plan, "max_clients", isUnlimited ? 5 : null)
                        }
                      >
                        {isUnlimited ? "Limitar" : "Ilimitado"}
                      </Button>
                    </div>
                  </div>

                  {/* Max colaboradores */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Máx. colaboradores</Label>
                    <Input
                      type="number"
                      min={1}
                      value={getValue(row, "max_collaborators") as number}
                      onChange={(e) => setField(row.plan, "max_collaborators", e.target.value === "" ? "" : parseInt(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="space-y-2">
                    {([
                      ["agenda", "Agenda"],
                      ["clients", "Clientes"],
                      ["financial", "Financeiro"],
                      ["expenses", "Despesas"],
                      ["reports", "Relatórios"],
                      ["export_reports", "Exportar relatórios"],
                      ["notifications", "Notificações"],
                      ["messages", "Mensagens"],
                      ["push_notifications", "Push notifications"],
                      ["multi_collaborators", "Multi colaboradores"],
                    ] as const).map(([field, label]) => (
                      <div key={field} className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Switch
                          checked={getValue(row, field) as boolean}
                          onCheckedChange={(val) => setField(row.plan, field, val)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Save */}
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={!hasChanges(row.plan) || updateMutation.isPending}
                    onClick={() => handleSave(row)}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
