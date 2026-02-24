import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { APP_VERSION } from "@/lib/appVersion";

export default function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload after a short delay to let SW activate
    setTimeout(() => window.location.reload(), 300);
  }, [waitingWorker]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let dismissed = false;

    const detectWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller && !dismissed) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }
    };

    const listenForUpdate = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller && !dismissed) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      detectWaiting(reg);
      listenForUpdate(reg);
    });

    // Check for updates every 60s
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }, 60_000);

    return () => {
      dismissed = true;
      clearInterval(interval);
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Nova versão disponível!</p>
          <p className="text-xs text-muted-foreground">Versão {APP_VERSION} disponível. Atualize agora.</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" onClick={handleUpdate} className="text-xs h-8">
            Atualizar agora
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowUpdate(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
