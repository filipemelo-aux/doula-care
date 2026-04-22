import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles } from "lucide-react";

interface GuestSignupPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional context shown above the message (e.g. "Para encontrar a doula mais próxima"). */
  reason?: string;
}

/**
 * Friendly modal shown to anonymous visitors when they try to access
 * a feature that requires an account (e.g. "Buscar doula").
 */
export function GuestSignupPrompt({
  open,
  onOpenChange,
  reason,
}: GuestSignupPromptProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-3">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
          </div>
          <DialogTitle className="text-lg font-display">
            Vamos te conectar a uma doula 💗
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {reason ||
              "Para encontrarmos a doula mais próxima de você e cuidarmos da sua jornada com carinho, precisamos de um cadastro rapidinho. Assim a doula consegue te conhecer melhor e responder seu pedido."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 bg-primary/5 rounded-xl p-3 text-left">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-snug">
            É gratuito e leva menos de 2 minutos. Seus dados ficam protegidos.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full h-11"
            onClick={() => {
              onOpenChange(false);
              navigate("/cadastro-visitante");
            }}
          >
            Criar minha conta
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
