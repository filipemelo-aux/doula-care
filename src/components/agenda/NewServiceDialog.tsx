import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Check, X, Loader2, CheckCircle, UserPlus } from "lucide-react";
import { maskCurrency, parseCurrency, maskPhone } from "@/lib/masks";
import { format } from "date-fns";
import { toast } from "sonner";

interface NewServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

export function NewServiceDialog({ open, onOpenChange }: NewServiceDialogProps) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customServiceName, setCustomServiceName] = useState("");
  const [showCustomService, setShowCustomService] = useState(false);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["agenda-clients-service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: customServices } = useQuery({
    queryKey: ["custom-services", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!organizationId,
  });

  const allServices = (customServices || []).map((s: any) => ({ id: s.id, name: s.name, icon: s.icon }));

  const addCustomServiceMutation = useMutation({
    mutationFn: async (serviceName: string) => {
      let icon = "🔧";
      try {
        const { data: fnData } = await supabase.functions.invoke("generate-service-icon", {
          body: { serviceName },
        });
        if (fnData?.icon) icon = fnData.icon;
      } catch { /* fallback */ }

      const { error } = await supabase
        .from("custom_services")
        .insert({ name: serviceName, organization_id: organizationId, icon });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-services"] });
    },
  });

  const deleteCustomServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase.from("custom_services").delete().eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-services"] });
      toast.success("Serviço removido");
    },
  });

  const quickClientMutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          full_name: name,
          phone,
          status: "gestante",
          plan: "avulso",
          payment_method: "pix",
          payment_status: "pendente",
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        })
        .select("id, full_name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agenda-clients-service"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-plans"] });
      setClientId(data.id);
      setShowQuickClient(false);
      setQuickClientName("");
      setQuickClientPhone("");
      toast.success(`Cliente "${data.full_name}" cadastrada!`);
    },
    onError: () => toast.error("Erro ao cadastrar cliente"),
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const amountValue = parseCurrency(amount) || 0;
      const description = `Serviço: ${selectedServices.join(", ")}`;

      // 1. Create transaction (revenue)
      const { data: newTransaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          description,
          amount: amountValue,
          amount_received: 0,
          date: serviceDate,
          client_id: clientId || null,
          payment_method: paymentMethod as any,
          notes: notes || null,
          installments: 1,
          installment_value: amountValue,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
          type: "receita" as const,
        })
        .select("id")
        .single();
      if (txError) throw txError;

      // 2. Create service_requests for each service
      if (clientId) {
        for (const svc of selectedServices) {
          await supabase.from("service_requests").insert({
            client_id: clientId,
            service_type: svc,
            status: "accepted",
            budget_value: amountValue / selectedServices.length,
            budget_sent_at: new Date().toISOString(),
            responded_at: new Date().toISOString(),
            organization_id: organizationId || null,
          });
        }
      }

      // 3. Create appointment
      if (clientId) {
        const aptDate = new Date(serviceDate + "T10:00:00");
        await supabase.from("appointments").insert({
          client_id: clientId,
          title: `Serviço: ${selectedServices.join(", ")}`,
          scheduled_at: aptDate.toISOString(),
          notes: notes || null,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-services"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments"] });
      toast.success("Serviço criado com sucesso!");
      resetAndClose();
    },
    onError: () => toast.error("Erro ao criar serviço"),
  });

  const resetAndClose = () => {
    setSelectedServices([]);
    setCustomServiceName("");
    setShowCustomService(false);
    setClientId("");
    setAmount("");
    setServiceDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentMethod("pix");
    setNotes("");
    setShowQuickClient(false);
    setQuickClientName("");
    setQuickClientPhone("");
    onOpenChange(false);
  };

  const handleSelectService = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    );
    setShowCustomService(false);
    setCustomServiceName("");
  };

  const handleCustomServiceConfirm = () => {
    if (customServiceName.trim()) {
      const name = customServiceName.trim();
      setSelectedServices((prev) => [...prev, name]);
      addCustomServiceMutation.mutate(name);
      setShowCustomService(false);
      setCustomServiceName("");
    }
  };

  const canSubmit = selectedServices.length > 0 && clientId && parseCurrency(amount) > 0 && serviceDate;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Novo Serviço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de Serviço *</Label>
            {allServices.length > 0 ? (
              <div className="max-h-[11rem] overflow-y-auto rounded-lg p-1">
                <div className="grid grid-cols-3 gap-2">
                  {allServices.map((service) => (
                    <div key={service.id} className="relative group/service p-0.5">
                      <button
                        type="button"
                        onClick={() => handleSelectService(service.name)}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-center transition-all w-full h-[4.5rem] ${
                          selectedServices.includes(service.name)
                            ? "border-primary bg-primary/10 ring-2 ring-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <span className="text-base leading-none">{service.icon}</span>
                        <span className="text-[11px] font-medium truncate w-full leading-tight">{service.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedServices.includes(service.name)) setSelectedServices((prev) => prev.filter((s) => s !== service.name));
                          deleteCustomServiceMutation.mutate(service.id);
                        }}
                        className="absolute top-0 right-0 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/service:opacity-100 transition-opacity z-10"
                        title="Remover serviço"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum serviço cadastrado. Clique abaixo para incluir.
              </p>
            )}

            {!showCustomService ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed gap-1.5 text-xs"
                onClick={() => {
                  setShowCustomService(true);
                  setSelectedServices([]);
                }}
              >
                <Plus className="h-3 w-3" />
                Incluir serviço
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do serviço..."
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomServiceConfirm();
                    }
                  }}
                />
                <Button type="button" size="sm" className="h-8" onClick={handleCustomServiceConfirm} disabled={!customServiceName.trim()}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => { setShowCustomService(false); setCustomServiceName(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {selectedServices.length > 0 && (
              <p className="text-xs text-success flex items-center gap-1 min-w-0">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {selectedServices.length === 1 ? "Serviço selecionado" : `${selectedServices.length} serviços selecionados`}:{" "}
                  <span className="font-medium">{selectedServices.join(", ")}</span>
                </span>
              </p>
            )}
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label className="text-xs">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione uma cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!showQuickClient ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed gap-1.5 text-xs"
                onClick={() => setShowQuickClient(true)}
              >
                <UserPlus className="h-3 w-3" />
                Cadastrar cliente avulsa
              </Button>
            ) : (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  Cadastro de Cliente Avulsa
                </p>
                <Input
                  placeholder="Nome completo"
                  value={quickClientName}
                  onChange={(e) => setQuickClientName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Input
                  placeholder="(00) 00000-0000"
                  value={quickClientPhone}
                  onChange={(e) => setQuickClientPhone(maskPhone(e.target.value))}
                  className="h-8 text-sm"
                  maxLength={16}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (quickClientName.trim() && quickClientPhone.trim()) {
                        quickClientMutation.mutate({ name: quickClientName.trim(), phone: quickClientPhone.trim() });
                      }
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs flex-1 gap-1"
                    onClick={() => {
                      if (quickClientName.trim() && quickClientPhone.trim()) {
                        quickClientMutation.mutate({ name: quickClientName.trim(), phone: quickClientPhone.trim() });
                      }
                    }}
                    disabled={!quickClientName.trim() || !quickClientPhone.trim() || quickClientMutation.isPending}
                  >
                    <Check className="h-3 w-3" />
                    {quickClientMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowQuickClient(false); setQuickClientName(""); setQuickClientPhone(""); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor Total *</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(maskCurrency(e.target.value))}
                className="mt-1 h-8 text-sm"
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label className="text-xs">Data do Serviço *</Label>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <Label className="text-xs">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              placeholder="Observações..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!canSubmit || createServiceMutation.isPending}
            onClick={() => createServiceMutation.mutate()}
          >
            {createServiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
