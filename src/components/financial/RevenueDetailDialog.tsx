import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Clock, AlertCircle, Zap } from "lucide-react";

interface RevenueDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function RevenueDetailDialog({ open, onOpenChange, transactionId }: RevenueDetailDialogProps) {
  const { data: transaction } = useQuery({
    queryKey: ["transaction-detail", transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("*, clients(full_name, dpp, phone, plan), plan_settings(name)")
        .eq("id", transactionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId && open,
  });

  const { data: payments } = useQuery({
    queryKey: ["transaction-payments", transactionId],
    queryFn: async () => {
      if (!transactionId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("installment_number");
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId && open,
  });

  if (!transaction) return null;

  const totalAmount = Number(transaction.amount) || 0;
  const receivedAmount = Number(transaction.amount_received) || 0;
  const pendingAmount = Math.max(0, totalAmount - receivedAmount);
  const progressPercent = totalAmount > 0 ? Math.min(100, (receivedAmount / totalAmount) * 100) : 0;
  const installments = Number(transaction.installments) || 1;
  const installmentValue = Number(transaction.installment_value) || totalAmount / installments;

  const statusInfo = pendingAmount === 0
    ? { label: "Quitado", variant: "default" as const, icon: CheckCircle, color: "text-success" }
    : receivedAmount > 0
    ? { label: "Parcial", variant: "secondary" as const, icon: AlertCircle, color: "text-warning" }
    : { label: "Pendente", variant: "outline" as const, icon: Clock, color: "text-muted-foreground" };

  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            Detalhes da Receita
            <Badge variant={statusInfo.variant} className="text-xs">
              <StatusIcon className={`h-3 w-3 mr-1 ${statusInfo.color}`} />
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              {transaction.is_auto_generated && <Zap className="h-3.5 w-3.5 text-warning" />}
              {transaction.description}
            </p>
            {transaction.clients?.full_name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliente: {transaction.clients.full_name}
              </p>
            )}
            {transaction.plan_settings?.name && (
              <p className="text-xs text-muted-foreground">
                Plano: {transaction.plan_settings.name}
              </p>
            )}
          </div>

          <Separator />

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Valor Total</span>
              <p className="text-sm font-semibold">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Parcelas</span>
              <p className="text-sm font-semibold">{installments}x de {formatCurrency(installmentValue)}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Recebido</span>
              <p className="text-sm font-semibold text-success">{formatCurrency(receivedAmount)}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Pendente</span>
              <p className={`text-sm font-semibold ${pendingAmount > 0 ? "text-warning" : "text-success"}`}>
                {pendingAmount > 0 ? formatCurrency(pendingAmount) : "Quitado"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase text-muted-foreground">Progresso</span>
              <span className="text-xs font-medium">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Data do Lançamento</span>
              <p className="text-sm">{format(parseISO(transaction.date), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Forma de Pagamento</span>
              <p className="text-sm">{paymentMethodLabels[transaction.payment_method || "pix"] || "—"}</p>
            </div>
            {(transaction.clients as any)?.dpp && (
              <div>
                <span className="text-[10px] uppercase text-muted-foreground">DPP</span>
                <p className="text-sm">{format(parseISO((transaction.clients as any).dpp), "dd/MM/yyyy")}</p>
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase text-muted-foreground">Cadastrado em</span>
              <p className="text-sm">{format(parseISO(transaction.created_at), "dd/MM/yyyy")}</p>
            </div>
          </div>

          {transaction.notes && (
            <>
              <Separator />
              <div>
                <span className="text-[10px] uppercase text-muted-foreground">Observações</span>
                <p className="text-sm text-muted-foreground mt-0.5">{transaction.notes}</p>
              </div>
            </>
          )}

          {/* Payment Records */}
          {payments && payments.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-[10px] uppercase text-muted-foreground mb-2 block">Parcelas</span>
                <div className="space-y-1.5">
                  {payments.map((p) => {
                    const isPaid = p.status === "pago";
                    const isPartial = p.status === "parcial";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {isPaid ? (
                            <CheckCircle className="h-3.5 w-3.5 text-success" />
                          ) : isPartial ? (
                            <AlertCircle className="h-3.5 w-3.5 text-warning" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span>Parcela {p.installment_number}/{p.total_installments}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.due_date && (
                            <span className="text-muted-foreground">
                              Venc: {format(parseISO(p.due_date), "dd/MM/yy")}
                            </span>
                          )}
                          <span className={isPaid ? "text-success font-medium" : isPartial ? "text-warning font-medium" : ""}>
                            {formatCurrency(Number(p.amount_paid))}/{formatCurrency(Number(p.amount))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
