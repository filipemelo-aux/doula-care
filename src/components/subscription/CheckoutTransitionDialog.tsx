import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface CheckoutTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  planPrice: string;
  checkoutUrl: string | null;
  error: string | null;
  onRetry: () => void;
}

export function CheckoutTransitionDialog({
  open,
  onOpenChange,
  planName,
  planPrice,
  checkoutUrl,
  error,
  onRetry,
}: CheckoutTransitionDialogProps) {
  const [redirected, setRedirected] = useState(false);
  const [checkoutWindow, setCheckoutWindow] = useState<Window | null>(null);

  useEffect(() => {
    if (!open || !checkoutUrl || error || redirected) return;
    const timer = setTimeout(() => {
      setRedirected(true);
      const win = window.open(checkoutUrl, "_blank");
      if (!win) {
        window.location.href = checkoutUrl;
        return;
      }
      setCheckoutWindow(win);
      setTimeout(() => onOpenChange(false), 500);
    }, 800);
    return () => clearTimeout(timer);
  }, [open, checkoutUrl, error, redirected, onOpenChange]);

  // Detecta quando a aba do checkout é fechada sem completar o pagamento
  useEffect(() => {
    if (!checkoutWindow) return;
    const interval = setInterval(() => {
      if (checkoutWindow.closed) {
        clearInterval(interval);
        setCheckoutWindow(null);
        // Pequeno delay para não conflitar com redirect de sucesso
        setTimeout(() => {
          const url = new URL(window.location.href);
          if (!url.searchParams.get("success") && !url.searchParams.get("session_id")) {
            toast.info("Compra cancelada. Você pode tentar novamente quando quiser.");
          }
        }, 800);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [checkoutWindow]);

  useEffect(() => {
    if (!open) setRedirected(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] text-center">
        <DialogTitle className="sr-only">Redirecionando para pagamento</DialogTitle>
        <div className="flex flex-col items-center gap-4 py-4">
          {error ? (
            <>
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Erro ao iniciar pagamento</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={onRetry} className="w-full mt-2">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  Redirecionando para pagamento seguro...
                </p>
                <p className="text-sm text-muted-foreground">
                  Plano <span className="font-medium capitalize">{planName}</span>
                </p>
                <p className="text-lg font-bold text-primary">{planPrice}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Pagamento processado pelo Stripe
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
