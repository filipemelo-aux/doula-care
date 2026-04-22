import { useEffect, useState } from "react";
import { LocationSettingsCard } from "@/components/settings/LocationSettingsCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Sparkles, Search, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LocationCoverage() {
  const { organizationId } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const storageKey = organizationId
    ? `location-coverage-welcome-seen:${organizationId}`
    : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const seen = localStorage.getItem(storageKey) === "1";
      if (!seen) setWelcomeOpen(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const handleClose = () => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    }
    setWelcomeOpen(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Localização e Atendimento</h1>
        <p className="page-description">
          Defina onde você atende para que gestantes encontrem você no mapa público.
        </p>
      </div>
      <LocationSettingsCard />

      <Dialog open={welcomeOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="flex justify-center -mt-2 mb-1">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/20 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-primary" strokeWidth={2} />
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-warning text-warning-foreground flex items-center justify-center shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl text-center font-display">
              Novidade: gestantes podem te encontrar! 💗
            </DialogTitle>
            <DialogDescription className="text-center text-[13.5px] leading-relaxed">
              Agora visitantes podem buscar a <strong>doula mais próxima</strong> diretamente
              pelo aplicativo. Preencha sua <strong>localização</strong> e
              <strong> regiões de atendimento</strong> para aparecer no mapa público e receber
              novos pedidos de vinculação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 mt-2 text-left">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <Search className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-muted-foreground leading-snug">
                Visitantes verão você no mapa quando buscarem por doulas em sua cidade.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-muted-foreground leading-snug">
                Quanto mais completa sua área de atendimento, mais chances de novos vínculos.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button onClick={handleClose} className="w-full">
              Quero preencher agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
