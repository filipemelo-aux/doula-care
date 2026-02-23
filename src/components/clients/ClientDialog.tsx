import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { format } from "date-fns";
import { CheckCircle } from "lucide-react";

import { maskPhone, maskCPF, maskCEP, maskCurrency, parseCurrency } from "@/lib/masks";
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
  payment_type: z.enum(["a_vista", "parcelado"]),
  installments: z.number().min(1).max(24).optional(),
  installment_frequency: z.enum(["semanal", "quinzenal", "mensal", "manual"]).optional(),
  custom_interval_days: z.number().min(1).max(365).optional(),
  first_due_date: z.string().optional(),
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
  const { user, organizationId } = useAuth();
  const [entryAlreadyPaid, setEntryAlreadyPaid] = useState(false);

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
        payment_type: "a_vista",
        installments: 1,
        installment_frequency: "mensal",
        custom_interval_days: 30,
        first_due_date: "",
        plan_value: 0,
        notes: "",
      },
  });

  const status = form.watch("status");
  const selectedPlan = form.watch("plan");
  const watchedPaymentType = form.watch("payment_type");
  const watchedFirstDueDate = form.watch("first_due_date");

  // Date-based auto-pay logic
  const today = format(new Date(), "yyyy-MM-dd");
  const relevantDate = watchedPaymentType === "parcelado" && watchedFirstDueDate ? watchedFirstDueDate : today;
  const isFirstDueDateInPast = relevantDate < today;
  const isFirstDueDateTodayOrFuture = relevantDate >= today;

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
        payment_type: "a_vista",
        installments: 1,
        installment_frequency: "mensal",
        custom_interval_days: 30,
        first_due_date: "",
        plan_value: Number(client.plan_value) || 0,
        notes: client.notes || "",
      });
      setEntryAlreadyPaid(false);
    } else {
      setEntryAlreadyPaid(false);
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
        payment_type: "a_vista",
        installments: 1,
        installment_frequency: "mensal",
        custom_interval_days: 30,
        first_due_date: "",
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
        plan_value: data.plan_value || 0,
        notes: data.notes || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
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
        
        // Determine auto-received based on date logic — account for ALL paid installments
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const installmentCount = data.payment_type === "parcelado" ? (data.installments || 1) : 1;
        const installmentVal = (data.plan_value || 0) / installmentCount;
        let autoReceived = 0;

        if (data.payment_type === "parcelado" && installmentCount > 1) {
          const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
          const frequency = data.installment_frequency || "mensal";
          const customDays = data.custom_interval_days || 30;
          for (let i = 0; i < installmentCount; i++) {
            const dueDate = new Date(firstDueDate);
            if (frequency === "semanal") dueDate.setDate(dueDate.getDate() + (7 * i));
            else if (frequency === "quinzenal") dueDate.setDate(dueDate.getDate() + (15 * i));
            else if (frequency === "manual") dueDate.setDate(dueDate.getDate() + (customDays * i));
            else dueDate.setMonth(dueDate.getMonth() + i);
            const dueDateStr = dueDate.toISOString().split("T")[0];
            const isPastDue = dueDateStr < todayStr;
            if (isPastDue || (entryAlreadyPaid && i === 0)) {
              autoReceived += installmentVal;
            }
          }
        } else {
          // À vista or single installment
          const firstDueDateStr = data.first_due_date || clientCreatedDate;
          if (firstDueDateStr < todayStr) {
            autoReceived = data.plan_value || 0;
          } else if (entryAlreadyPaid) {
            autoReceived = installmentVal;
          }
        }

        const transactionPayload = {
          type: "receita" as const,
          description: `Contrato - ${data.full_name} - Plano ${planName}`,
          amount: data.plan_value || 0,
          amount_received: autoReceived,
          date: clientCreatedDate,
          client_id: newClient.id,
          plan_id: planSetting?.id || null,
          payment_method: data.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto",
          is_auto_generated: true,
          installments: data.payment_type === "parcelado" ? (data.installments || 1) : 1,
          installment_value: data.payment_type === "parcelado" && data.installments 
            ? (data.plan_value || 0) / data.installments 
            : (data.plan_value || 0),
          notes: `Receita gerada automaticamente ao cadastrar cliente`,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        };

        const { error: transactionError } = await supabase
          .from("transactions")
          .insert([transactionPayload]);
        if (transactionError) throw transactionError;

        // Create payment records with due dates if parcelado
        if (data.payment_type === "parcelado" && data.installments && data.installments > 1) {
          const installmentCount = data.installments;
          const installmentAmount = (data.plan_value || 0) / installmentCount;
          const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
          
          const frequency = data.installment_frequency || "mensal";
          const customDays = data.custom_interval_days || 30;
          
          const paymentRecords = Array.from({ length: installmentCount }, (_, i) => {
            const dueDate = new Date(firstDueDate);
            if (frequency === "semanal") {
              dueDate.setDate(dueDate.getDate() + (7 * i));
            } else if (frequency === "quinzenal") {
              dueDate.setDate(dueDate.getDate() + (15 * i));
            } else if (frequency === "manual") {
              dueDate.setDate(dueDate.getDate() + (customDays * i));
            } else {
              dueDate.setMonth(dueDate.getMonth() + i);
            }
            const dueDateStr = dueDate.toISOString().split("T")[0];
            const isPastDue = dueDateStr < todayStr;
            return {
              client_id: newClient.id,
              installment_number: i + 1,
              total_installments: installmentCount,
              amount: installmentAmount,
              amount_paid: isPastDue || (entryAlreadyPaid && i === 0) ? installmentAmount : 0,
              due_date: dueDateStr,
              status: isPastDue || (entryAlreadyPaid && i === 0) ? "pago" : "pendente",
              paid_at: isPastDue || (entryAlreadyPaid && i === 0) ? new Date().toISOString() : null,
              owner_id: user?.id || null,
              organization_id: organizationId || null,
            };
          });

          const { error: paymentError } = await supabase
            .from("payments")
            .insert(paymentRecords);
          if (paymentError) console.error("Error creating payments:", paymentError);
        }

        // Create user for client if DPP is set (gestante with expected delivery date)
        if (data.dpp && data.status === "gestante") {
          try {
            const response = await supabase.functions.invoke("create-client-user", {
              body: {
                clientId: newClient.id,
                fullName: data.full_name,
                dpp: data.dpp,
                organizationId: organizationId || null,
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

  const handleSubmitClick = () => {
    form.handleSubmit(onSubmit)();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle className="font-display text-lg">
            {client ? "Editar Cliente" : "Nova Cliente"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
              {/* Dados Pessoais */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Nome da cliente" />
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
                            className="h-9 text-sm" 
                            placeholder="(00) 00000-0000"
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
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
                            className="h-9 text-sm" 
                            placeholder="000.000.000-00"
                            onChange={(e) => field.onChange(maskCPF(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">CEP</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-9 text-sm" 
                            placeholder="00000-000"
                            onChange={(e) => {
                              const value = maskCEP(e.target.value);
                              field.onChange(value);
                              // Auto-fill address when CEP has 9 chars (with dash)
                              if (value.replace(/\D/g, "").length === 8) {
                                fetch(`https://viacep.com.br/ws/${value.replace(/\D/g, "")}/json/`)
                                  .then(res => res.json())
                                  .then(data => {
                                    if (!data.erro) {
                                      form.setValue("street", data.logradouro || "");
                                      form.setValue("neighborhood", data.bairro || "");
                                      form.setValue("city", data.localidade || "");
                                      form.setValue("state", data.uf || "");
                                    }
                                  })
                                  .catch(() => {});
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="space-y-1 md:col-span-2">
                        <FormLabel className="text-xs">Rua</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Nome da rua" />
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
                          <Input {...field} className="h-9 text-sm" placeholder="123" />
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
                          <Input {...field} className="h-9 text-sm" placeholder="Bairro" />
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
                          <Input {...field} className="h-9 text-sm" placeholder="Cidade" />
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
                          <Input {...field} className="h-9 text-sm" placeholder="UF" maxLength={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Acompanhante */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Acompanhante
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="companion_name"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Nome do Acompanhante</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-9 text-sm" placeholder="Nome do acompanhante" />
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
                        <FormLabel className="text-xs">Telefone do Acompanhante</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-9 text-sm" 
                            placeholder="(00) 00000-0000"
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Status e Gestação */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status e Gestação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Situação *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tentante">Tentante</SelectItem>
                            <SelectItem value="gestante">Gestante</SelectItem>
                            <SelectItem value="lactante">Puérpera</SelectItem>
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
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">DPP (Data Provável do Parto)</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                className="h-9 text-sm"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="baby_names"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Nomes do(s) Bebê(s)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="h-9 text-sm" 
                                placeholder="Nome1, Nome2..."
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

              {/* Plano e Pagamento */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Plano e Pagamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Plano *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione" />
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
                            className="h-9 text-sm"
                            value={field.value ? maskCurrency(String(Math.round(field.value * 100))) : ""}
                            onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                            placeholder="R$ 0,00"
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
                        <FormLabel className="text-xs">Método de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
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
                    name="payment_type"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Tipo de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="a_vista">À Vista</SelectItem>
                            <SelectItem value="parcelado">Parcelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   {form.watch("payment_type") === "parcelado" && (
                    <>
                      <FormField
                        control={form.control}
                        name="installments"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Parcelas</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={String(field.value || 1)}
                            >
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                                  <SelectItem key={num} value={String(num)}>
                                    {num}x
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="installment_frequency"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Frequência</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "mensal"}>
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
                                <SelectItem value="quinzenal">Quinzenal (15 dias)</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="manual">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {form.watch("installment_frequency") === "manual" && (
                        <FormField
                          control={form.control}
                          name="custom_interval_days"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Intervalo (dias)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={365}
                                  className="h-9 text-sm"
                                  value={field.value || 30}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="first_due_date"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">1º Vencimento</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                className="h-9 text-sm"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {/* Auto-pay logic indicator */}
                {!client && (
                  <div className="rounded-lg border p-3 space-y-1">
                    {isFirstDueDateInPast ? (
                      <p className="text-xs text-success flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        A data é anterior a hoje — entrada será marcada como <strong>Recebida</strong> automaticamente.
                      </p>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entryAlreadyPaid}
                          onChange={(e) => setEntryAlreadyPaid(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-xs font-medium">Entrada já foi recebida?</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
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
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                size="sm" 
                disabled={mutation.isPending}
                onClick={handleSubmitClick}
              >
                {mutation.isPending ? "Salvando..." : client ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
