import { Download, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function InstallAppButton() {
  const { canInstall, install, isStandalone, showIosInstructions, showAndroidInstructions } = usePwaInstall();

  if (isStandalone) return null;

  if (canInstall) {
    return (
      <Button onClick={install} variant="outline" size="sm" className="gap-2">
        <Download className="h-4 w-4" />
        Instalar Doula Care
      </Button>
    );
  }

  if (showIosInstructions) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-md border border-border bg-muted/50">
        <Share className="h-4 w-4 shrink-0" />
        <span>Toque em <strong>Compartilhar</strong> e depois <strong>"Adicionar à Tela de Início"</strong></span>
      </div>
    );
  }

  if (showAndroidInstructions) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-md border border-border bg-muted/50">
        <MoreVertical className="h-4 w-4 shrink-0" />
        <span>Toque em <strong>Menu ⋮</strong> e depois <strong>"Adicionar à tela inicial"</strong></span>
      </div>
    );
  }

  return null;
}
