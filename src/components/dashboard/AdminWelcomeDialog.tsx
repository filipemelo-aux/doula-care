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
            Seu espaço está pronto! Você tem 7 dias grátis de Premium para explorar tudo.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
            <p className="font-medium">Primeiros passos:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>Cadastre suas gestantes na aba <strong className="whitespace-nowrap">Clientes</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>Configure seus planos em <strong className="whitespace-nowrap">Configurações</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Heart className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>Acompanhe tudo pelo <strong className="whitespace-nowrap">Dashboard</strong></span>
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
