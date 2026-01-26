import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateCurrentPregnancyWeeks } from "@/lib/pregnancy";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { maskPhone, maskCPF, maskCEP } from "@/lib/masks";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const clientSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  phone: z.string().min(10, "Telefone inválido").max(20),
  cpf: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  companion_name: z.string().optional(),
  companion_phone: z.string().optional(),
  status: z.enum(["tentante", "gestante", "lactante"]),
  pregnancy_weeks: z.number().min(0).max(42).optional().nullable(),
  dpp: z.string().optional().nullable(),
  baby_names: z.string().optional(),
  plan: z.enum(["basico", "intermediario", "completo"]),
  payment_method: z.enum(["pix", "cartao", "dinheiro", "transferencia"]),
  payment_status: z.enum(["pendente", "pago", "parcial"]),
  plan_value: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export function ClientDialog({ open, onOpenChange, client }: ClientDialogProps) {
  const queryClient = useQueryClient();

  const { data: planSettings } = useQuery({
    queryKey: ["plan-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      cpf: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      zip_code: "",
      companion_name: "",
      companion_phone: "",
      status: "gestante",
      pregnancy_weeks: null,
      dpp: null,
      baby_names: "",
      plan: "basico",
      payment_method: "pix",
      payment_status: "pendente",
      plan_value: 0,
      notes: "",
    },
  });

  const status = form.watch("status");
  const selectedPlan = form.watch("plan");

  // Update plan value when plan changes
  useEffect(() => {
    if (planSettings && selectedPlan && !client) {
      const planSetting = planSettings.find((p) => p.plan_type === selectedPlan);
      if (planSetting) {
        form.setValue("plan_value", Number(planSetting.default_value));
      }
    }
  }, [selectedPlan, planSettings, form, client]);

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      form.reset({
        full_name: client.full_name,
        phone: client.phone,
        cpf: client.cpf || "",
        street: client.street || "",
        number: client.number || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        zip_code: client.zip_code || "",
        companion_name: client.companion_name || "",
        companion_phone: client.companion_phone || "",
        status: client.status as "tentante" | "gestante" | "lactante",
        pregnancy_weeks: client.pregnancy_weeks,
        dpp: client.dpp || null,
        baby_names: (client as any).baby_names?.join(", ") || "",
        plan: client.plan as "basico" | "intermediario" | "completo",
        payment_method: client.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia",
        payment_status: client.payment_status as "pendente" | "pago" | "parcial",
        plan_value: Number(client.plan_value) || 0,
        notes: client.notes || "",
      });
    } else {
      form.reset({
        full_name: "",
        phone: "",
        cpf: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
        companion_name: "",
        companion_phone: "",
        status: "gestante",
        pregnancy_weeks: null,
        dpp: null,
        baby_names: "",
        plan: "basico",
        payment_method: "pix",
        payment_status: "pendente",
        plan_value: planSettings?.find((p) => p.plan_type === "basico")?.default_value || 0,
        notes: "",
      });
    }
  }, [client, form, planSettings]);

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const payload = {
        full_name: data.full_name,
        phone: data.phone,
        cpf: data.cpf || null,
        street: data.street || null,
        number: data.number || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        companion_name: data.companion_name || null,
        companion_phone: data.companion_phone || null,
        status: data.status,
        pregnancy_weeks: data.status === "gestante" && data.dpp 
          ? calculateCurrentPregnancyWeeks(null, null, data.dpp) 
          : null,
        dpp: data.status === "gestante" ? data.dpp || null : null,
        baby_names: data.baby_names 
          ? data.baby_names.split(",").map(n => n.trim()).filter(n => n.length > 0)
          : [],
        pregnancy_weeks_set_at: data.status === "gestante" && data.dpp
          ? new Date().toISOString() 
          : undefined,
        plan: data.plan,
        payment_method: data.payment_method,
        payment_status: data.payment_status,
        plan_value: data.plan_value || 0,
        notes: data.notes || null,
      };

      if (client) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", client.id);
        if (error) throw error;

        // Update auto-generated transaction description if client name or plan changed
        const planName = data.plan === "basico" ? "Básico" : data.plan === "intermediario" ? "Intermediário" : "Completo";
        const newDescription = `Contrato - ${data.full_name} - Plano ${planName}`;
        
        const { error: transactionError } = await supabase
          .from("transactions")
          .update({ 
            description: newDescription,
            amount: data.plan_value || 0,
          })
          .eq("client_id", client.id)
          .eq("is_auto_generated", true);
        
        if (transactionError) {
          console.error("Error updating transaction:", transactionError);
        }
      } else {
        // Create client and get the ID and created_at
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert(payload)
          .select("id, created_at")
          .single();
        if (clientError) throw clientError;

        // Get plan settings to find the plan ID
        const planSetting = planSettings?.find((p) => p.plan_type === data.plan);

        // Create automatic income transaction for the new client using client's created_at date in local timezone
        const planName = data.plan === "basico" ? "Básico" : data.plan === "intermediario" ? "Intermediário" : "Completo";
        const getLocalDate = (dateString: string) => {
          const date = new Date(dateString);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const clientCreatedDate = newClient.created_at 
          ? getLocalDate(newClient.created_at)
          : getLocalDate(new Date().toISOString());
        
        const transactionPayload = {
          type: "receita" as const,
          description: `Contrato - ${data.full_name} - Plano ${planName}`,
          amount: data.plan_value || 0,
          date: clientCreatedDate,
          client_id: newClient.id,
          plan_id: planSetting?.id || null,
          payment_method: data.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto",
          is_auto_generated: true,
          notes: `Receita gerada automaticamente ao cadastrar cliente`,
        };

        const { error: transactionError } = await supabase
          .from("transactions")
          .insert([transactionPayload]);
        if (transactionError) throw transactionError;

        // Create user for client if DPP is set (gestante with expected delivery date)
        if (data.dpp && data.status === "gestante") {
          try {
            const response = await supabase.functions.invoke("create-client-user", {
              body: {
                clientId: newClient.id,
                fullName: data.full_name,
                dpp: data.dpp,
              },
            });

            if (response.error) {
              console.error("Error creating client user:", response.error);
              toast.info("Cliente cadastrada, mas houve um erro ao criar acesso da gestante");
            } else if (response.data?.email) {
              toast.info(`Acesso criado: ${response.data.email}`);
            }
          } catch (userError) {
            console.error("Error invoking create-client-user:", userError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
      toast.success(client ? "Cliente atualizada!" : "Cliente cadastrada com receita!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao salvar cliente");
    },
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg">
            {client ? "Editar Cliente" : "Nova Cliente"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Dados Pessoais */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b pb-1">
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 space-y-1">
                        <FormLabel className="text-xs">Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Telefone *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field h-8 text-sm"
                            placeholder="(11) 99999-9999"
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            maxLength={16}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">CPF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field h-8 text-sm"
                            placeholder="000.000.000-00"
                            onChange={(e) => field.onChange(maskCPF(e.target.value))}
                            maxLength={14}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b pb-1">
                  Endereço
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 space-y-1">
                        <FormLabel className="text-xs">Rua</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Número</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Estado</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" placeholder="SP" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 space-y-1">
                        <FormLabel className="text-xs">CEP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field h-8 text-sm"
                            placeholder="00000-000"
                            onChange={(e) => field.onChange(maskCEP(e.target.value))}
                            maxLength={9}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Acompanhante */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b pb-1">
                  Dados do Acompanhante
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="companion_name"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Nome do(a) Acompanhante</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companion_phone"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Telefone do(a) Acompanhante</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field h-8 text-sm"
                            placeholder="(11) 99999-9999"
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            maxLength={16}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Perfil Materno */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b pb-1">
                  Perfil Materno
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Situação *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tentante">Tentante</SelectItem>
                            <SelectItem value="gestante">Gestante</SelectItem>
                            <SelectItem value="lactante">Lactante</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {status === "gestante" && (
                    <>
                      <FormField
                        control={form.control}
                        name="dpp"
                        render={({ field }) => {
                          const calculatedWeeks = field.value 
                            ? calculateCurrentPregnancyWeeks(null, null, field.value)
                            : null;
                          
                          return (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">DPP (Data Prevista Parto)</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value || null)}
                                  className="input-field h-8 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Semanas Atuais</label>
                        <div className="input-field h-8 text-sm flex items-center px-3 bg-muted/50">
                          {(() => {
                            const dppValue = form.watch("dpp");
                            const weeks = dppValue 
                              ? calculateCurrentPregnancyWeeks(null, null, dppValue)
                              : null;
                            return weeks !== null ? `${weeks} semanas` : "Defina a DPP";
                          })()}
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name="baby_names"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2 space-y-1">
                            <FormLabel className="text-xs">Nome(s) do Bebê</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="input-field h-8 text-sm"
                                placeholder="Separe por vírgula se gêmeos (ex: João, Maria)"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Dados do Plano */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b pb-1">
                  Dados do Plano
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Plano *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basico">Básico</SelectItem>
                            <SelectItem value="intermediario">Intermediário</SelectItem>
                            <SelectItem value="completo">Completo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plan_value"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Valor (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="input-field h-8 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Pagamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="cartao">Cartão</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_status"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[60px] resize-none text-sm"
                        placeholder="Anotações sobre a cliente..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando..." : client ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
