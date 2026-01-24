import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  pregnancy_weeks: z.number().min(0).max(45).optional().nullable(),
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
        pregnancy_weeks: data.status === "gestante" ? data.pregnancy_weeks : null,
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
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      toast.success(client ? "Cliente atualizada!" : "Cliente cadastrada!");
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
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {client ? "Editar Cliente" : "Nova Cliente"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field"
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
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field"
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
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" placeholder="SP" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field"
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
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                  Dados do Acompanhante
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companion_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do(a) Acompanhante</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companion_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone do(a) Acompanhante</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="input-field"
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
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                  Perfil Materno
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situação *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field">
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
                    <FormField
                      control={form.control}
                      name="pregnancy_weeks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Semanas de Gravidez</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={45}
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              className="input-field"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Dados do Plano */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                  Dados do Plano
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plano Contratado *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field">
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
                      <FormItem>
                        <FormLabel>Valor do Plano (R$)</FormLabel>
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
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field">
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
                      <FormItem>
                        <FormLabel>Status do Pagamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field">
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
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[100px] resize-none"
                        placeholder="Anotações sobre a cliente..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
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
