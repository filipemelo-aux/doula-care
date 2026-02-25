import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { maskCurrency, parseCurrency } from "@/lib/masks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, AlertTriangle, Loader2, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  transactionAmount: number;
  transactionInstallments: number;
  clientId: string | null;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  transactionId,
  transactionAmount,
  transactionInstallments,
  clientId,
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [selectedInstallment, setSelectedInstallment] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"total" | "parcial">("total");
  const [partialValue, setPartialValue] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  // Fetch payments for this transaction (by transaction_id first, fallback to client_id)
  const { data: payments, isLoading } = useQuery({
    queryKey: ["transaction-payments", transactionId, clientId],
    queryFn: async () => {
      if (!transactionId) return [];

      // First try by transaction_id
      const { data: byTx, error: txErr } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("installment_number", { ascending: true });
      if (txErr) throw txErr;
      if (byTx && byTx.length > 0) return byTx;

      // Fallback: for contract transactions where payments have no transaction_id,
      // find by client_id + matching total_installments
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

  // If no payment records exist, we work directly with the transaction
  const hasPaymentRecords = payments && payments.length > 0;

  // Auto-provision payment records for transactions with installments > 1 but no payments
  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId || !clientId || transactionInstallments <= 1) return;
      const installmentValue = transactionAmount / transactionInstallments;
      const records = Array.from({ length: transactionInstallments }, (_, i) => ({
        client_id: clientId,
        transaction_id: transactionId,
        installment_number: i + 1,
        total_installments: transactionInstallments,
        amount: installmentValue,
        amount_paid: 0,
        status: "pendente",
      }));
      const { error } = await supabase.from("payments").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-payments", transactionId, clientId] });
    },
  });

  useEffect(() => {
    if (open && payments !== undefined && !hasPaymentRecords && transactionInstallments > 1 && clientId && !provisionMutation.isPending) {
      provisionMutation.mutate();
    }
  }, [open, payments, hasPaymentRecords, transactionInstallments, clientId]);

  useEffect(() => {
    if (open) {
      setSelectedInstallment("");
      setPaymentType("total");
      setPartialValue("");
      setPaymentDate(new Date());
    }
  }, [open]);

  // Auto-select first pending installment
  useEffect(() => {
    if (hasPaymentRecords && !selectedInstallment) {
      const firstPending = payments.find((p) => p.status !== "pago");
      if (firstPending) {
        setSelectedInstallment(firstPending.id);
      }
    }
  }, [payments, hasPaymentRecords, selectedInstallment]);

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId) throw new Error("Transaction not found");

      if (hasPaymentRecords && selectedInstallment) {
        // Update payment record
        const payment = payments!.find((p) => p.id === selectedInstallment);
        if (!payment) throw new Error("Payment not found");

        const payAmount =
          paymentType === "total"
            ? payment.amount
            : parseCurrency(partialValue) || 0;

        const newAmountPaid = Math.min(
          Number(payment.amount_paid) + payAmount,
          Number(payment.amount)
        );

        const { error: paymentError } = await supabase
          .from("payments")
          .update({ amount_paid: newAmountPaid, paid_at: newAmountPaid >= Number(payment.amount) ? paymentDate.toISOString() : null })
          .eq("id", selectedInstallment);
        if (paymentError) throw paymentError;

        // Recalculate total received across all payments for this transaction
        // Try by transaction_id first, fallback to client_id with null transaction_id
        let allPayments: { amount_paid: number }[] = [];
        const { data: byTx } = await supabase
          .from("payments")
          .select("amount_paid")
          .eq("transaction_id", transactionId);
        
        if (byTx && byTx.length > 0) {
          allPayments = byTx;
        } else if (clientId) {
          const { data: byClient } = await supabase
            .from("payments")
            .select("amount_paid")
            .eq("client_id", clientId)
            .is("transaction_id", null);
          allPayments = byClient || [];
        }

        const totalReceived = (allPayments || []).reduce((sum, p) => {
          return sum + Number(p.amount_paid || 0);
        }, 0);

        const { error: txError } = await supabase
          .from("transactions")
          .update({ amount_received: totalReceived })
          .eq("id", transactionId);
        if (txError) throw txError;
      } else {
        // No payment records - update transaction directly
        const payAmount =
          paymentType === "total"
            ? transactionAmount
            : parseCurrency(partialValue) || 0;

        const { data: current, error: fetchErr } = await supabase
          .from("transactions")
          .select("amount_received")
          .eq("id", transactionId)
          .single();
        if (fetchErr) throw fetchErr;

        const newReceived = Math.min(
          Number(current.amount_received || 0) + payAmount,
          transactionAmount
        );

        const { error: txError } = await supabase
          .from("transactions")
          .update({ amount_received: newReceived })
          .eq("id", transactionId);
        if (txError) throw txError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Pagamento registrado!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao registrar pagamento");
    },
  });

  const selectedPayment = hasPaymentRecords
    ? payments!.find((p) => p.id === selectedInstallment)
    : null;

  const remainingForSelected = selectedPayment
    ? Number(selectedPayment.amount) - Number(selectedPayment.amount_paid)
    : transactionAmount;

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusInfo = (status: string) => {
    if (status === "pago")
      return { icon: CheckCircle2, color: "text-emerald-600", label: "Pago" };
    if (status === "parcial")
      return { icon: Clock, color: "text-amber-600", label: "Parcial" };
    return {
      icon: AlertTriangle,
      color: "text-destructive",
      label: "Pendente",
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Lançar Pagamento</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Installment selection */}
            {hasPaymentRecords ? (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Parcela</Label>
                <Select
                  value={selectedInstallment}
                  onValueChange={setSelectedInstallment}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione a parcela" />
                  </SelectTrigger>
                  <SelectContent>
                    {payments!.map((p) => {
                      const status = getStatusInfo(p.status);
                      const StatusIcon = status.icon;
                      const remaining =
                        Number(p.amount) - Number(p.amount_paid);
                      return (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          disabled={p.status === "pago"}
                        >
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={`h-3 w-3 ${status.color}`}
                            />
                            <span>
                              {p.installment_number}/{p.total_installments}
                            </span>
                            <span className="text-muted-foreground">
                              {formatCurrency(Number(p.amount))}
                            </span>
                            {p.due_date && (
                              <span className="text-muted-foreground text-xs">
                                •{" "}
                                {format(
                                  new Date(p.due_date + "T12:00:00"),
                                  "dd/MM/yy",
                                  { locale: ptBR }
                                )}
                              </span>
                            )}
                            {remaining > 0 && remaining < Number(p.amount) && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4"
                              >
                                Resta {formatCurrency(remaining)}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                Pagamento direto (sem parcelas cadastradas)
              </div>
            )}

            {/* Payment type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipo de Pagamento</Label>
              <Select
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as "total" | "parcial")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">
                    Pagamento Total — {formatCurrency(remainingForSelected)}
                  </SelectItem>
                  <SelectItem value="parcial">Pagamento Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partial value */}
            {paymentType === "parcial" && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Valor Recebido</Label>
                <Input
                  value={partialValue}
                  onChange={(e) =>
                    setPartialValue(maskCurrency(e.target.value))
                  }
                  placeholder="R$ 0,00"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Restante:{" "}
                  {formatCurrency(
                    Math.max(
                      0,
                      remainingForSelected -
                        (parseCurrency(partialValue) || 0)
                    )
                  )}
                </p>
              </div>
            )}

            {/* Payment date */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Data do Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-9 text-sm justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(d) => d && setPaymentDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={() => recordPaymentMutation.mutate()}
              disabled={
                recordPaymentMutation.isPending ||
                (hasPaymentRecords && !selectedInstallment) ||
                (paymentType === "parcial" &&
                  (!partialValue || parseCurrency(partialValue) <= 0))
              }
              className="w-full"
            >
              {recordPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Registrando...
                </>
              ) : "Confirmar Pagamento"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
