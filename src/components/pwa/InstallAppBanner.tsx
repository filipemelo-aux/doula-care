import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useState } from "react";

export default function InstallAppBanner() {
  const { isInstallable, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (isStandalone || dismissed) return null;

  if (isInstallable) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Download className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium truncate">Instale o Papo de Doula no seu celular!</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={promptInstall}
            className="text-xs h-8"
          >
            Instalar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Download className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm truncate">
            Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 flex-shrink-0 text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return null;
}
