import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  QrCode,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDetailsDialog({ open, onOpenChange }: PaymentDetailsDialogProps) {
  const { client } = useGestanteAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // First try payments table, fallback to transactions
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["client-payments-detail", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", client.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id && open,
  });

  // Also fetch from transactions (where actual data lives)
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["client-transactions-detail", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("client_id", client.id)
        .eq("type", "receita");
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id && open,
  });

  const { data: pixSettings } = useQuery({
    queryKey: ["admin-pix-settings-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("pix_key, pix_key_type, pix_beneficiary_name")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const isLoading = paymentsLoading || transactionsLoading;

  // Use payments if available, otherwise derive from transactions
  const hasPayments = payments && payments.length > 0;

  // Calculate from transactions
  const totalAmount = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalReceived = transactions?.reduce((sum, t) => sum + Number(t.amount_received || 0), 0) || 0;
  const totalPending = Math.max(0, totalAmount - totalReceived);
  const progressPercent = totalAmount > 0 ? (totalReceived / totalAmount) * 100 : 0;

  // Build installment details from transactions
  const installmentDetails = transactions?.flatMap((t) => {
    const installments = Number(t.installments) || 1;
    const installmentValue = Number(t.installment_value) || Number(t.amount);
    const received = Number(t.amount_received) || 0;

    if (installments <= 1) {
      const status = received >= Number(t.amount) ? "pago" : received > 0 ? "parcial" : "pendente";
      return [{
        id: t.id,
        description: t.description,
        installment_number: 1,
        total_installments: 1,
        amount: Number(t.amount),
        amount_paid: received,
        status,
        due_date: t.date,
      }];
    }

    // Multiple installments
    const entries = [];
    let remainingPaid = received;
    for (let i = 1; i <= installments; i++) {
      const amt = i === installments
        ? Number(t.amount) - installmentValue * (installments - 1)
        : installmentValue;
      const paidForThis = Math.min(remainingPaid, amt);
      remainingPaid = Math.max(0, remainingPaid - paidForThis);
      const status = paidForThis >= amt ? "pago" : paidForThis > 0 ? "parcial" : "pendente";

      entries.push({
        id: `${t.id}-${i}`,
        description: t.description,
        installment_number: i,
        total_installments: installments,
        amount: amt,
        amount_paid: paidForThis,
        status,
        due_date: t.date,
      });
    }
    return entries;
  }) || [];

  // If we have real payments data, use it; otherwise use derived
  const displayItems = hasPayments
    ? payments.map((p) => ({
        id: p.id,
        description: `Parcela ${p.installment_number}/${p.total_installments}`,
        installment_number: p.installment_number,
        total_installments: p.total_installments,
        amount: Number(p.amount),
        amount_paid: Number(p.amount_paid),
        status: p.status,
        due_date: p.due_date,
      }))
    : installmentDetails;

  const handleCopyPix = async () => {
    if (!pixSettings?.pix_key) return;
    try {
      await navigator.clipboard.writeText(pixSettings.pix_key);
      setCopiedId("pix");
      toast.success("Chave Pix copiada!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "pago") return { variant: "default" as const, label: "Pago", icon: CheckCircle2, color: "text-emerald-600" };
    if (status === "parcial") return { variant: "secondary" as const, label: "Parcial", icon: Clock, color: "text-amber-600" };
    return { variant: "destructive" as const, label: "Pendente", icon: AlertTriangle, color: "text-destructive" };
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pixKeyTypeLabel: Record<string, string> = {
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    random: "Chave aleatória",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Detalhes Financeiros</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Progresso do pagamento</span>
                  <span className="text-sm font-medium">{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(totalReceived)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Restante</p>
                    <p className="text-sm font-semibold text-destructive">{formatCurrency(totalPending)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pix Payment */}
            {pixSettings?.pix_key && totalPending > 0 && (
              <Card className="border-primary/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-sm">Pagar via Pix</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {pixKeyTypeLabel[pixSettings.pix_key_type || "random"] || "Chave Pix"}
                    </p>
                    <p className="text-sm font-mono break-all">{pixSettings.pix_key}</p>
                    {pixSettings.pix_beneficiary_name && (
                      <p className="text-xs text-muted-foreground">
                        Beneficiário: {pixSettings.pix_beneficiary_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCopyPix}
                  >
                    {copiedId === "pix" ? (
                      <><Check className="h-4 w-4 mr-2" /> Copiado!</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-2" /> Copiar chave Pix</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Após o pagamento, envie o comprovante pela aba de mensagens
                  </p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Installments List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Parcelas</h3>
              {displayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma parcela encontrada
                </p>
              ) : (
                displayItems.map((item) => {
                  const status = getStatusBadge(item.status);
                  const StatusIcon = status.icon;

                  return (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${status.color}`} />
                            <div>
                              <p className="text-sm font-medium">
                                Parcela {item.installment_number}/{item.total_installments}
                              </p>
                              {item.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(item.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                            {item.status === "parcial" && (
                              <p className="text-xs text-muted-foreground">
                                Pago: {formatCurrency(item.amount_paid)}
                              </p>
                            )}
                            <Badge variant={status.variant} className="text-[10px] mt-1">
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
