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
import { getLocalDate } from "@/lib/utils";

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDetailsDialog({ open, onOpenChange }: PaymentDetailsDialogProps) {
  const { client } = useGestanteAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery({
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

  const { data: pixSettings } = useQuery({
    queryKey: ["admin-pix-settings"],
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

  const totalAmount = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const totalPending = Math.max(0, totalAmount - totalPaid);
  const progressPercent = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

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

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "pago") return false;
    return new Date(dueDate) < new Date();
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
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(totalPaid)}</p>
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
              {(!payments || payments.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma parcela encontrada
                </p>
              ) : (
                payments.map((payment) => {
                  const status = getStatusBadge(payment.status);
                  const overdue = isOverdue(payment.due_date, payment.status);
                  const StatusIcon = status.icon;

                  return (
                    <Card
                      key={payment.id}
                      className={`${overdue ? "border-destructive/40 bg-destructive/5" : ""}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${status.color}`} />
                            <div>
                              <p className="text-sm font-medium">
                                Parcela {payment.installment_number}/{payment.total_installments}
                              </p>
                              {payment.due_date && (
                                <p className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                  {overdue ? "Vencida em " : "Vence em "}
                                  {format(getLocalDate(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(Number(payment.amount))}</p>
                            {payment.status === "parcial" && (
                              <p className="text-xs text-muted-foreground">
                                Pago: {formatCurrency(Number(payment.amount_paid))}
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
