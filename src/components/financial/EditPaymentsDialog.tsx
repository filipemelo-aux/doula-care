import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { maskCurrency, parseCurrency } from "@/lib/masks";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, AlertTriangle, Loader2, CalendarIcon, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  clientId: string | null;
}

interface DraftPayment {
  id: string;
  installment_number: number;
  total_installments: number;
  amount: string; // masked currency
  amount_paid: string; // masked currency
  due_date: string | null; // yyyy-MM-dd
  paid_at: string | null; // ISO
  status: string;
  _original: {
    amount: number;
    amount_paid: number;
    due_date: string | null;
    paid_at: string | null;
  };
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EditPaymentsDialog({
  open,
  onOpenChange,
  transactionId,
  clientId,
}: EditPaymentsDialogProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DraftPayment[]>([]);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["edit-payments", transactionId, clientId],
    queryFn: async () => {
      if (!transactionId) return [];
      const { data: byTx, error: txErr } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("installment_number", { ascending: true });
      if (txErr) throw txErr;
      if (byTx && byTx.length > 0) return byTx;
      if (clientId) {
        const { data: byClient, error: clientErr } = await supabase
          .from("payments")
          .select("*")
          .eq("client_id", clientId)
          .is("transaction_id", null)
          .order("installment_number", { ascending: true });
        if (clientErr) throw clientErr;
        return byClient || [];
      }
      return [];
    },
    enabled: !!transactionId && open,
  });

  useEffect(() => {
    if (payments) {
      setDrafts(
        payments.map((p: any) => ({
          id: p.id,
          installment_number: p.installment_number,
          total_installments: p.total_installments,
          amount: maskCurrency(String(Math.round(Number(p.amount) * 100))),
          amount_paid: maskCurrency(String(Math.round(Number(p.amount_paid) * 100))),
          due_date: p.due_date,
          paid_at: p.paid_at,
          status: p.status,
          _original: {
            amount: Number(p.amount),
            amount_paid: Number(p.amount_paid),
            due_date: p.due_date,
            paid_at: p.paid_at,
          },
        }))
      );
    }
  }, [payments]);

  const updateDraft = (id: string, patch: Partial<DraftPayment>) => {
    setDrafts((arr) => arr.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const d of drafts) {
        const newAmount = parseCurrency(d.amount) || 0;
        const newPaid = parseCurrency(d.amount_paid) || 0;
        const patch: any = {};
        if (newAmount !== d._original.amount) patch.amount = newAmount;
        if (newPaid !== d._original.amount_paid) patch.amount_paid = newPaid;
        if (d.due_date !== d._original.due_date) patch.due_date = d.due_date;
        if (d.paid_at !== d._original.paid_at) patch.paid_at = d.paid_at;
        if (Object.keys(patch).length === 0) continue;

        // If marking as fully paid and no paid_at yet, set it
        if (
          patch.amount_paid !== undefined &&
          patch.amount_paid >= (patch.amount ?? d._original.amount) &&
          !d.paid_at
        ) {
          patch.paid_at = new Date().toISOString();
        }
        // If clearing payment, also clear paid_at
        if (patch.amount_paid === 0) {
          patch.paid_at = null;
        }

        const { error } = await supabase
          .from("payments")
          .update(patch)
          .eq("id", d.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["edit-payments"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Pagamentos atualizados");
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao atualizar pagamentos");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edit-payments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Parcela removida");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Não é possível remover parcela com pagamento recebido");
    },
  });

  const getStatusInfo = (status: string) => {
    if (status === "pago")
      return { icon: CheckCircle2, color: "text-emerald-600", label: "Pago" };
    if (status === "parcial")
      return { icon: Clock, color: "text-amber-600", label: "Parcial" };
    return { icon: AlertTriangle, color: "text-destructive", label: "Pendente" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Editar Pagamentos</DialogTitle>
          <DialogDescription className="text-xs">
            Ajuste valores, datas ou remova parcelas. Para alterar plano, forma de pagamento ou número de parcelas, edite no cadastro da cliente (aba Plano).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Esta receita não possui parcelas cadastradas.
          </p>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => {
              const status = getStatusInfo(d.status);
              const StatusIcon = status.icon;
              const hasPaid = d._original.amount_paid > 0;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-border/60 p-3 space-y-3 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className="text-sm font-medium">
                        Parcela {d.installment_number}/{d.total_installments}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {status.label}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={hasPaid || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title={hasPaid ? "Parcela com pagamento não pode ser removida" : "Remover parcela"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor da parcela</Label>
                      <Input
                        value={d.amount}
                        onChange={(e) => updateDraft(d.id, { amount: maskCurrency(e.target.value) })}
                        disabled={hasPaid}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor recebido</Label>
                      <Input
                        value={d.amount_paid}
                        onChange={(e) => updateDraft(d.id, { amount_paid: maskCurrency(e.target.value) })}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={hasPaid}
                            className={cn(
                              "w-full h-9 text-sm justify-start text-left font-normal",
                              !d.due_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {d.due_date
                              ? format(parseISO(d.due_date), "dd/MM/yyyy", { locale: ptBR })
                              : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999] pointer-events-auto" align="start">
                          <Calendar
                            mode="single"
                            selected={d.due_date ? parseISO(d.due_date) : undefined}
                            onSelect={(date) =>
                              date &&
                              updateDraft(d.id, {
                                due_date: format(date, "yyyy-MM-dd"),
                              })
                            }
                            initialFocus
                            locale={ptBR}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data do pagamento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-9 text-sm justify-start text-left font-normal",
                              !d.paid_at && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {d.paid_at
                              ? format(new Date(d.paid_at), "dd/MM/yyyy", { locale: ptBR })
                              : "Não pago"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999] pointer-events-auto" align="start">
                          <Calendar
                            mode="single"
                            selected={d.paid_at ? new Date(d.paid_at) : undefined}
                            onSelect={(date) =>
                              updateDraft(d.id, {
                                paid_at: date ? date.toISOString() : null,
                              })
                            }
                            initialFocus
                            locale={ptBR}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <p className="text-[11px] text-muted-foreground">
                Parcelas já pagas têm valor e vencimento bloqueados.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">
                  Cancelar
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="h-9 gap-1.5"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
