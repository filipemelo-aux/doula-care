import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PushNotificationToggleProps {
  compact?: boolean;
}

export function PushNotificationToggle({ compact = false }: PushNotificationToggleProps) {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success("Notificações desativadas");
    } else {
      const success = await subscribe();
      if (success) {
        toast.success("Notificações ativadas! Você receberá alertas no celular.");
      } else if (permission === "denied") {
        toast.error("Notificações bloqueadas. Habilite nas configurações do navegador.");
      } else {
        toast.error("Não foi possível ativar as notificações.");
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
