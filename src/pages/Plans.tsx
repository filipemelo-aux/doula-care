import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Edit2, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const planLabels = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
};

const planColors = {
  basico: "bg-secondary",
  intermediario: "bg-primary/10",
  completo: "bg-gradient-to-br from-primary to-accent",
};

export default function Plans() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    default_value: number;
    features: string[];
  }>({ name: "", description: "", default_value: 0, features: [] });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plan-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*")
        .order("default_value", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clientCounts } = useQuery({
    queryKey: ["client-plan-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("plan");
      if (error) throw error;
      
      const counts: Record<string, number> = {
        basico: 0,
        intermediario: 0,
        completo: 0,
      };
      
      data?.forEach((client) => {
        if (client.plan) {
          counts[client.plan] = (counts[client.plan] || 0) + 1;
        }
      });
      
      return counts;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name: string;
      description: string;
      default_value: number;
      features: string[];
    }) => {
      const { error } = await supabase
        .from("plan_settings")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Plano atualizado!");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar plano");
    },
  });

  const handleEdit = (plan: typeof plans[0]) => {
    setEditingId(plan.id);
    setEditForm({
      name: plan.name,
      description: plan.description || "",
      default_value: Number(plan.default_value),
      features: plan.features || [],
    });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({
      id,
      ...editForm,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Planos</h1>
          <p className="page-description">Configure os planos oferecidos</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Planos</h1>
        <p className="page-description">
          Configure os planos e valores oferecidos às suas clientes
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isEditing = editingId === plan.id;
          const planType = plan.plan_type as keyof typeof planLabels;
          const isCompleto = planType === "completo";

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden ${
                isCompleto
                  ? "border-primary/30 shadow-lg"
                  : "card-glass"
              }`}
            >
              {isCompleto && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-bl-lg">
                  Popular
                </div>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`${planColors[planType]} ${
                      isCompleto ? "text-primary-foreground" : ""
                    }`}
                  >
                    {planLabels[planType]}
                  </Badge>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(plan)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="input-field mt-2"
                  />
                ) : (
                  <CardTitle className="text-2xl font-display">
                    {plan.name}
                  </CardTitle>
                )}
                {isEditing ? (
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="mt-2 min-h-[60px] resize-none"
                  />
                ) : (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price */}
                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        value={editForm.default_value}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            default_value: Number(e.target.value),
                          })
                        }
                        className="input-field"
                      />
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-foreground">
                      {formatCurrency(Number(plan.default_value))}
                    </div>
                  )}
                </div>

                {/* Client Count */}
                <p className="text-sm text-muted-foreground">
                  {clientCounts?.[planType] || 0} cliente(s) neste plano
                </p>

                {/* Features */}
                <div className="space-y-2">
                  {isEditing ? (
                    <Textarea
                      value={editForm.features.join("\n")}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: e.target.value.split("\n").filter(Boolean),
                        })
                      }
                      placeholder="Uma feature por linha"
                      className="min-h-[120px] resize-none text-sm"
                    />
                  ) : (
                    plan.features?.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Edit Actions */}
                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleSave(plan.id)}
                      disabled={updateMutation.isPending}
                      className="flex-1"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
