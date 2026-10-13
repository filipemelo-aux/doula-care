import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.doulacare.app";

/**
 * Bloqueia o app Android instalado de uma versão antiga (sem o módulo de
 * compras nativo) e pede atualização na Google Play. Só age quando o Super
 * Admin liga "android_force_update" — evita travar usuários antes da
 * aprovação da nova versão na loja.
 */
export function AndroidUpdateGate() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    // Versões novas incluem o plugin nativo de compras; as antigas não.
    if (Capacitor.isPluginAvailable("Purchases")) return;
    supabase
      .from("system_config")
      .select("value")
      .eq("key", "android_force_update")
      .maybeSingle()
      .then(({ data }) => {
        if (String((data as any)?.value ?? "").trim() === "true") setBlocked(true);
      });
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-background flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Download className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">Nova versão disponível</h1>
        <p className="text-sm text-muted-foreground">
          Para continuar usando o Doula Care, atualize o aplicativo na Google Play.
        </p>
        <Button className="w-full" onClick={() => window.open(PLAY_URL, "_system")}>
          Atualizar agora
        </Button>
      </div>
    </div>
  );
}
