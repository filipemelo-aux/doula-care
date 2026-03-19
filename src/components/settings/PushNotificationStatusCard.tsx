import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Loader2, CheckCircle2, XCircle, Smartphone, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PushPermissionModal } from "@/components/notifications/PushPermissionModal";
import { supabase } from "@/integrations/supabase/client";

export function PushNotificationStatusCard() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const [showModal, setShowModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!isSupported) {
    return (
      <Card className="card-glass">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <BellOff className="h-5 w-5" />
            <p className="text-sm">Notificações push não são suportadas neste navegador.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true);

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success("Notificações desativadas");
    } else if (permission === "denied") {
      toast.error("Notificações bloqueadas. Habilite nas configurações do navegador.");
    } else {
      setShowModal(true);
    }
  };

  const handleFullReset = async () => {
    setIsResetting(true);
    try {
      // 1. Unsubscribe from push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        // Remove from DB
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
        }
      }

      // 2. Delete all caches
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));

      // 3. Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));

      // 4. Clear push-related localStorage
      localStorage.removeItem("vapid_public_key");

      toast.success("Reset completo! Recarregando o app...");

      // 5. Reload to re-register SW in fresh context
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Error during full reset:", err);
      toast.error("Erro ao resetar. Tente novamente.");
      setIsResetting(false);
    }
  };

  return (
    <>
      <Card className="card-glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSubscribed ? "bg-success/10" : "bg-muted"}`}>
              {isSubscribed ? (
                <Bell className="w-5 h-5 text-success" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Notificações Push</CardTitle>
              <CardDescription>Receba alertas importantes no seu dispositivo</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isSubscribed
                  ? "bg-success/10 text-success"
                  : permission === "denied"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              }
            >
              {isSubscribed ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" />Ativas</>
              ) : permission === "denied" ? (
                <><XCircle className="w-3 h-3 mr-1" />Bloqueadas</>
              ) : (
                <><BellOff className="w-3 h-3 mr-1" />Inativas</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Modo: {isStandalone ? "App instalado" : "Navegador"}
              </span>
            </div>
            {permission === "denied" && (
              <p className="text-xs text-destructive/80 leading-relaxed">
                As notificações foram bloqueadas. Para reativar, acesse as configurações do navegador
                e permita notificações para este site.
              </p>
            )}
          </div>

          <Button
            variant={isSubscribed ? "outline" : "default"}
            className="w-full gap-2"
            onClick={handleToggle}
            disabled={isLoading || permission === "denied"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              <><BellOff className="h-4 w-4" />Desativar notificações</>
            ) : (
              <><Bell className="h-4 w-4" />Ativar notificações</>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
            onClick={handleFullReset}
            disabled={isResetting}
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Resetar notificações (limpar cache e reconectar)
          </Button>
        </CardContent>
      </Card>

      <PushPermissionModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
}
