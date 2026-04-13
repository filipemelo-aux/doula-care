import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PaymentStatusDialogProps {
  open: boolean;
  onClose: () => void;
  orderNsu: string;
  planName: string;
  planPrice: string;
  gateway: string;
}

export default function PaymentStatusDialog({
  open,
  orderNsu,
  planName,
  planPrice,
  gateway,
  onClose,
}: PaymentStatusDialogProps) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["org-plan"] });
    queryClient.invalidateQueries({ queryKey: ["active-subscription"] });
    queryClient.invalidateQueries({ queryKey: ["platform-plan-limits"] });
  }, [queryClient]);

  const checkPayment = useCallback(async () => {
    const { data, error } = await supabase
      .from("plan_payments")
      .select("status")
      .eq("order_nsu", orderNsu)
      .maybeSingle();

    if (!error && data?.status === "paid") {
      setConfirmed(true);
      stopPolling();
      toast.success("Pagamento confirmado!");
      invalidateAll();
    }
  }, [orderNsu, stopPolling, invalidateAll]);

  useEffect(() => {
    if (!open || confirmed || !orderNsu) {
      stopPolling();
      return;
    }
    checkPayment();
    pollingRef.current = setInterval(checkPayment, 5000);
    return () => stopPolling();
  }, [open, confirmed, orderNsu, checkPayment, stopPolling]);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
    }
  }, [open]);

  const handleManualCheck = async () => {
    setManualChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-payment-status", {
        body: { order_nsu: orderNsu },
      });
      if (error) throw error;
      if (data?.paid) {
        setConfirmed(true);
        stopPolling();
        toast.success("Pagamento confirmado!");
        invalidateAll();
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      }
    } catch {
      toast.error("Erro ao verificar pagamento.");
    } finally {
      setManualChecking(false);
    }
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-background flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border/50 bg-background">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            Processando pagamento
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {planName} — {planPrice}
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 text-primary/60 shrink-0" />
      </div>

      {/* Content */}
      {confirmed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">
              Pagamento confirmado!
            </p>
            <p className="text-sm text-muted-foreground">
              Seu plano {planName} foi ativado com sucesso.
            </p>
          </div>
          <Button className="w-full max-w-xs h-12 rounded-xl" onClick={handleClose}>
            Voltar ao app
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <p className="text-base font-semibold text-foreground">
              Aguardando confirmação
            </p>
            <p className="text-sm text-muted-foreground">
              {gateway === "mock"
                ? "Pagamento em modo de teste. Use o botão abaixo para simular."
                : "Seu pagamento está sendo processado..."}
            </p>
          </div>

          <div className="w-full max-w-xs space-y-3">
            <Button
              className="w-full h-11 rounded-xl"
              onClick={handleManualCheck}
              disabled={manualChecking}
            >
              {manualChecking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Já fiz o pagamento
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl"
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/60">
            Ref: {orderNsu}
          </p>
        </div>
      )}
    </div>
  );
}
