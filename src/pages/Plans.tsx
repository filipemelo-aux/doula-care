import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Check, Edit2, Plus, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

type PlanSetting = Tables<"plan_settings">;

const planLabels = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
};

const planSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(100),
  description: z.string().max(500).optional(),
  default_value: z.number().min(0, "Valor deve ser positivo"),
  features: z.string().optional(),
  is_active: z.boolean(),
});

type PlanFormData = z.infer<typeof planSchema>;

export default function Plans() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanSetting | null>(null);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      description: "",
      default_value: 0,
      features: "",
      is_active: true,
    },
  });

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
      const { data, error } = await supabase.from("clients").select("plan");
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
      description: string | null;
      default_value: number;
      features: string[] | null;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("plan_settings")
        .update({
          name: data.name,
          description: data.description,
          default_value: data.default_value,
          features: data.features,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Plano atualizado!");
      setDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar plano");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("plan_settings")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Status do plano atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleEdit = (plan: PlanSetting) => {
    setSelectedPlan(plan);
    form.reset({
      name: plan.name,
      description: plan.description || "",
      default_value: Number(plan.default_value),
      features: plan.features?.join("\n") || "",
      is_active: plan.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = (plan: PlanSetting) => {
    toggleStatusMutation.mutate({
      id: plan.id,
      is_active: !(plan.is_active ?? true),
    });
  };

  const onSubmit = (data: PlanFormData) => {
    if (!selectedPlan) return;

    updateMutation.mutate({
      id: selectedPlan.id,
      name: data.name,
      description: data.description || null,
      default_value: data.default_value,
      features: data.features ? data.features.split("\n").filter(Boolean) : null,
      is_active: data.is_active,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate total revenue from active plans
  const totalPlanRevenue = plans?.reduce((sum, plan) => {
    const planType = plan.plan_type as keyof typeof planLabels;
    const count = clientCounts?.[planType] || 0;
    return sum + count * Number(plan.default_value);
  }, 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Planos</h1>
          <p className="page-description">Configure os planos oferecidos</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
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

      {/* Summary Card */}
      <Card className="card-glass border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Receita Potencial Total</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(totalPlanRevenue)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Baseado nos planos contratados pelas clientes
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {plans?.filter((p) => p.is_active !== false).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Planos Ativos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {Object.values(clientCounts || {}).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const planType = plan.plan_type as keyof typeof planLabels;
          const isCompleto = planType === "completo";
          const isActive = plan.is_active !== false;

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all ${
                !isActive ? "opacity-60" : ""
              } ${isCompleto && isActive ? "border-primary/30 shadow-lg" : "card-glass"}`}
            >
              {/* Status Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {isCompleto && isActive && (
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    Popular
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={isActive ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}
                >
                  {isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <CardHeader className="pt-12">
                <Badge variant="outline" className="w-fit mb-2">
                  {planLabels[planType]}
                </Badge>
                <CardTitle className="text-2xl font-display">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className="text-3xl font-bold text-foreground">
                  {formatCurrency(Number(plan.default_value))}
                </div>

                {/* Client Count */}
                <p className="text-sm text-muted-foreground">
                  {clientCounts?.[planType] || 0} cliente(s) neste plano
                </p>

                {/* Features */}
                <div className="space-y-2 min-h-[120px]">
                  {plan.features?.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleEdit(plan)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant={isActive ? "ghost" : "secondary"}
                    size="icon"
                    onClick={() => handleToggleStatus(plan)}
                    title={isActive ? "Desativar plano" : "Ativar plano"}
                  >
                    {isActive ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Editar Plano</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Plano *</FormLabel>
                    <FormControl>
                      <Input {...field} className="input-field" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[80px] resize-none"
                        placeholder="Descreva o plano..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="input-field"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviços Inclusos</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[120px] resize-none"
                        placeholder="Um serviço por linha:&#10;Consultas mensais&#10;Suporte via WhatsApp&#10;Material educativo"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Digite um serviço por linha
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Plano Ativo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Planos inativos não aparecem para novas contratações
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
