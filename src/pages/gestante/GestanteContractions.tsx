import { useState } from "react";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from "lucide-react";

export default function GestanteContractions() {
  return (
    <GestanteLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg">Contrações</h1>
            <p className="text-xs text-muted-foreground">Acompanhe suas contrações</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-dashed">
          <CardContent className="py-12 text-center">
            <Timer className="h-12 w-12 mx-auto text-primary/40 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Em breve</h3>
            <p className="text-muted-foreground text-sm">
              O timer de contrações estará disponível em breve para ajudá-la durante o trabalho de parto
            </p>
          </CardContent>
        </Card>
      </div>
    </GestanteLayout>
  );
}
