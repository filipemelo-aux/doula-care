import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, ShieldCheck, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface PushPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PushPermissionModal({ open, onOpenChange }: PushPermissionModalProps) {
  const { subscribe, isLoading } = usePushNotifications();
  const [step, setStep] = useState<"explain" | "success" | "denied">("explain");

  const handleActivate = useCallback(async () => {
    const result = await subscribe();
    if (result) {
      setStep("success");
    } else {
      setStep("denied");
    }
  }, [subscribe]);

  const handleClose = () => {
    setStep("explain");
    onOpenChange(false);
  };

  const handleDismiss = () => {
    // Mark as dismissed so we don't auto-show again
    localStorage.setItem("push_prompt_dismissed", "true");
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm sm:max-w-md">
        {step === "explain" && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="font-display text-xl">
                Ativar notificações importantes
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                O Doula Care precisa de permissão para enviar notificações importantes, como{" "}
                <strong>novas mensagens</strong>, <strong>registros no diário</strong> e{" "}
                <strong>lembretes de consultas</strong>.
              </DialogDescription>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Mesmo quando o aplicativo estiver fechado, você continuará recebendo avisos importantes.
              </p>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleActivate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Ativar notificações
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                Agora não
              </Button>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-success" />
              </div>
              <DialogTitle className="font-display text-xl">
                Notificações ativadas com sucesso!
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Você receberá alertas importantes mesmo com o app fechado.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para garantir que você receba todas as notificações, mantenha o aplicativo instalado
                  e permita a execução em segundo plano nas configurações do seu celular.
                </p>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={handleClose}>
              Entendido
            </Button>
          </>
        )}

        {step === "denied" && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <BellOff className="h-8 w-8 text-destructive" />
              </div>
              <DialogTitle className="font-display text-xl">
                Notificações bloqueadas
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                As notificações foram bloqueadas pelo navegador. Para ativá-las, acesse as
                configurações do navegador e permita notificações para este site.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode ativar as notificações a qualquer momento nas <strong>Configurações</strong> do aplicativo.
              </p>
            </div>

            <Button variant="outline" className="w-full mt-2" onClick={handleClose}>
              Fechar
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
