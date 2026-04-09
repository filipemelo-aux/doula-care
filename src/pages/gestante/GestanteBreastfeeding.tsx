import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Baby, Construction } from "lucide-react";

export default function GestanteBreastfeeding() {
  return (
    <GestanteLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dicas de Amamentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Conteúdos e orientações para o seu puerpério</p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Baby className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Construction className="h-5 w-5" />
              <span className="text-sm font-medium">Página em construção</span>
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-xs">
              Em breve você terá acesso a dicas e orientações sobre amamentação preparadas especialmente para você.
            </p>
          </div>
        </div>
      </div>
    </GestanteLayout>
  );
}
