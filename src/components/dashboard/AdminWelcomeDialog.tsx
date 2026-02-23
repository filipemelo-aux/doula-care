import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart } from "lucide-react";

interface AdminWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  name: string | null;
}

export function AdminWelcomeDialog({ open, onClose, name }: AdminWelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display">
            Bem-vinda, {name || "Doula"}! 🎉
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-muted-foreground">
            Seu cadastro foi aprovado e seu espaço está pronto!
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
            <p className="font-medium">Primeiros passos:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Cadastre suas gestantes na aba <strong>Clientes</strong>
              </li>
              <li className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Configure seus planos em <strong>Configurações</strong>
              </li>
              <li className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Acompanhe tudo pelo <strong>Dashboard</strong>
              </li>
            </ul>
          </div>
          <Button onClick={onClose} className="w-full">
            Começar a usar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
