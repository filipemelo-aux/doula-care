import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";

interface PushNotificationToggleProps {
  compact?: boolean;
}

export function PushNotificationToggle({ compact = false }: PushNotificationToggleProps) {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { limits, planLabel } = usePlanLimits();

  if (!isSupported) return null;

  if (!limits.pushNotifications) {
    if (compact) return null;
    return (
      <Button variant="outline" disabled className="gap-2 opacity-60">
        <Crown className="h-4 w-4" />
        Push (Plano Pro)
      </Button>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success("Notificações desativadas");
    } else {
      const result = await subscribe();
      if (result === true) {
        toast.success("Notificações ativadas! Você receberá alertas no celular.");
      } else if (result === "denied") {
        toast.error("Notificações bloqueadas. Habilite nas configurações do navegador.");
      } else {
        toast.error("Erro ao ativar notificações. Tente novamente.");
      }
    }
  };

  if (compact) {
    return (
      <Button
        variant={isSubscribed ? "secondary" : "outline"}
        size="icon"
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? "Desativar notificações" : "Ativar notificações"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "secondary" : "default"}
      onClick={handleToggle}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          Notificações Ativas
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Ativar Notificações
        </>
      )}
    </Button>
  );
}
