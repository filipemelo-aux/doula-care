import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  CalendarIcon,
  Trash2,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  clientId: string | null;
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
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [confirmEstorno, setConfirmEstorno] = useState(false);

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

  // Auto-provision payment records for transactions that have none (e.g. à vista or legacy)
  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId || !clientId) return;
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .select("amount, amount_received, installments, due_date, date, organization_id")
        .eq("id", transactionId)
        .maybeSingle();
      if (txErr) throw txErr;
      if (!tx) return;
      const totalInstallments = Math.max(1, Number((tx as any).installments) || 1);
      const total = Number(tx.amount) || 0;
      const installmentValue = total / totalInstallments;
      let remaining = Math.min(Math.max(Number(tx.amount_received) || 0, 0), total);
      const baseDate = (tx as any).due_date || tx.date || new Date().toISOString().slice(0, 10);
      const records = Array.from({ length: totalInstallments }, (_, i) => {
        const amountPaid = Math.min(installmentValue, remaining);
        remaining = Math.max(0, remaining - amountPaid);
        return {
          client_id: clientId,
          transaction_id: transactionId,
          organization_id: (tx as any).organization_id,
          installment_number: i + 1,
          total_installments: totalInstallments,
          amount: Number(installmentValue.toFixed(2)),
          amount_paid: Number(amountPaid.toFixed(2)),
          due_date: baseDate,
          status: amountPaid >= installmentValue ? "pago" : amountPaid > 0 ? "parcial" : "pendente",
          paid_at: amountPaid >= installmentValue ? new Date().toISOString() : null,
        };
      });
      const { error } = await supabase.from("payments").insert(records as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edit-payments", transactionId, clientId] });
    },
  });

  useEffect(() => {
    if (open && payments && payments.length === 0 && transactionId && clientId && !provisionMutation.isPending) {
      provisionMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payments, transactionId, clientId]);

  // Auto-select first pending installment when payments load
  useEffect(() => {
    if (!open) return;
    if (!payments || payments.length === 0) return;
    if (selectedId && payments.find((p: any) => p.id === selectedId)) return;
    const firstPending = payments.find((p: any) => Number(p.amount_paid) < Number(p.amount));
    setSelectedId((firstPending || payments[0]).id);
  }, [payments, open]);

  const selected = useMemo(
    () => payments?.find((p: any) => p.id === selectedId) || null,
    [payments, selectedId]
  );

  // Sync form when selection changes
  useEffect(() => {
    if (!selected) {
      setAmount("");
      setDueDate("");
      return;
    }
    setAmount(maskCurrency(String(Math.round(Number(selected.amount) * 100))));
    setDueDate(selected.due_date || "");
  }, [selected?.id]);

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setConfirmEstorno(false);
    }
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["edit-payments"] });
    queryClient.invalidateQueries({ queryKey: ["transaction-payments"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const isPaid = selected ? Number(selected.amount_paid) >= Number(selected.amount) && Number(selected.amount) > 0 : false;
  const isPartial = selected ? Number(selected.amount_paid) > 0 && Number(selected.amount_paid) < Number(selected.amount) : false;
  const hasAnyPayment = selected ? Number(selected.amount_paid) > 0 : false;

  // Save: update selected parcel + redistribute change across remaining UNPAID parcels (keeping total stable)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !payments) return;
      const newAmount = parseCurrency(amount) || 0;
      const oldAmount = Number(selected.amount);
      const delta = newAmount - oldAmount; // positive = need to reduce others; negative = increase others

      // Update selected parcel (only amount + due_date editable for unpaid)
      const patchSelected: any = {};
      if (newAmount !== oldAmount) patchSelected.amount = newAmount;
      if (dueDate !== selected.due_date) patchSelected.due_date = dueDate;

      if (Object.keys(patchSelected).length > 0) {
        const { error } = await supabase
          .from("payments")
          .update(patchSelected)
          .eq("id", selected.id);
        if (error) throw error;
      }

      // Redistribute delta across remaining unpaid parcels (other than this one)
      if (Math.abs(delta) > 0.001) {
        const others = payments.filter(
          (p: any) => p.id !== selected.id && Number(p.amount_paid) === 0
        );
        if (others.length > 0) {
          const adjust = -delta / others.length; // each gets a slice of the inverse delta
          for (const o of others) {
            const newVal = Math.max(0, Number(o.amount) + adjust);
            const { error } = await supabase
              .from("payments")
              .update({ amount: Number(newVal.toFixed(2)) })
              .eq("id", o.id);
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Parcela atualizada");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao atualizar parcela");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase.from("payments").delete().eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Parcela removida");
      setSelectedId("");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Não é possível remover parcela com pagamento");
    },
  });

  const estornoMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase.rpc("revert_installment_payment", {
        p_payment_id: selected.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pagamento estornado");
      setConfirmEstorno(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao estornar pagamento");
      setConfirmEstorno(false);
    },
  });

  const getStatusInfo = (p: any) => {
    const paid = Number(p.amount_paid);
    const total = Number(p.amount);
    if (paid >= total && total > 0)
      return { icon: CheckCircle2, color: "text-emerald-600", label: "Pago" };
    if (paid > 0)
      return { icon: Clock, color: "text-amber-600", label: "Parcial" };
    return { icon: AlertTriangle, color: "text-destructive", label: "Pendente" };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Parcela</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Esta receita não possui parcelas cadastradas.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Installment selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Parcela</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione a parcela" />
                  </SelectTrigger>
                  <SelectContent>
                    {payments.map((p: any) => {
                      const s = getStatusInfo(p);
                      const Icon = s.icon;
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-3 w-3 ${s.color}`} />
                            <span>
                              {p.installment_number}/{p.total_installments}
                            </span>
                            <span className="text-muted-foreground">
                              {formatCurrency(Number(p.amount))}
                            </span>
                            {p.due_date && (
                              <span className="text-muted-foreground text-xs">
                                • {format(parseISO(p.due_date), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selected && (
                <>
                  {/* Status info */}
                  <div className="rounded-lg bg-muted/40 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          isPaid && "border-emerald-500/40 text-emerald-700",
                          isPartial && "border-amber-500/40 text-amber-700"
                        )}
                      >
                        {getStatusInfo(selected).label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Recebido: {formatCurrency(Number(selected.amount_paid))}
                      </span>
                    </div>
                    {hasAnyPayment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmEstorno(true)}
                        className="h-7 px-2 text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-500/10"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Estornar
                      </Button>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Valor da parcela</Label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(maskCurrency(e.target.value))}
                      disabled={hasAnyPayment}
                      className="h-9 text-sm"
                    />
                    {!hasAnyPayment && (
                      <p className="text-[11px] text-muted-foreground">
                        Alterações serão redistribuídas entre as demais parcelas pendentes.
                      </p>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Data de vencimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={hasAnyPayment}
                          className={cn(
                            "w-full h-9 text-sm justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate
                            ? format(parseISO(dueDate), "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 z-[9999] pointer-events-auto"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={dueDate ? parseISO(dueDate) : undefined}
                          onSelect={(d) => d && setDueDate(format(d, "yyyy-MM-dd"))}
                          initialFocus
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={hasAnyPayment || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                      className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || hasAnyPayment}
                      className="h-8 gap-1"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEstorno} onOpenChange={setConfirmEstorno}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O valor recebido desta parcela será zerado e ela voltará a constar como pendente.
              Você poderá então editar valor, vencimento ou remover a parcela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                estornoMutation.mutate();
              }}
              disabled={estornoMutation.isPending}
            >
              {estornoMutation.isPending ? "Estornando..." : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
