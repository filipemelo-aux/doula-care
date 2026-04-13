import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface FullscreenCheckoutProps {
  open: boolean;
  onClose: () => void;
  checkoutUrl: string;
  orderNsu: string;
  planName: string;
  planPrice: string;
}

export default function FullscreenCheckout({
  open,
  checkoutUrl,
  orderNsu,
  planName,
  planPrice,
  onClose,
}: FullscreenCheckoutProps) {
  const queryClient = useQueryClient();
  const [iframeLoaded, setIframeLoaded] = useState(false);
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

  // Start polling when open
  useEffect(() => {
    if (!open || confirmed || !orderNsu) {
      stopPolling();
      return;
    }
    checkPayment();
    pollingRef.current = setInterval(checkPayment, 5000);
    return () => stopPolling();
  }, [open, confirmed, orderNsu, checkPayment, stopPolling]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setIframeLoaded(false);
      setConfirmed(false);
    }
  }, [open]);

  const handleManualCheck = async () => {
    setManualChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
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
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            Finalizar pagamento
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {planName} — {planPrice}
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 text-primary/60 shrink-0" />
      </div>

      {/* Confirmed state */}
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
        <>
          {/* Loading skeleton */}
          {!iframeLoaded && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparando pagamento...</p>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={checkoutUrl}
            className={`flex-1 w-full border-0 ${iframeLoaded ? "" : "sr-only"}`}
            onLoad={() => setIframeLoaded(true)}
            allow="payment"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
          />

          {/* Footer */}
          <div className="shrink-0 border-t border-border/50 bg-background px-4 py-3 flex gap-3 safe-area-bottom">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl"
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
          </div>
        </>
      )}
    </div>
  );
}
