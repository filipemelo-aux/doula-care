import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Search } from "lucide-react";

interface GuestIntroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFindDoula: () => void;
}

/**
 * Interactive first-visit welcome shown in the center of the screen
 * for anonymous visitors. Purely informational + CTA.
 */
export function GuestIntroDialog({ open, onOpenChange, onFindDoula }: GuestIntroDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-display text-lg">
            Bem-vinda à Doula Care 💗
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Você pode explorar livremente todos os recursos. E quando quiser,
            é só encontrar uma doula perto de você para começar seu acompanhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button className="w-full h-11 gap-2" onClick={onFindDoula}>
            <Search className="h-4 w-4" />
            Encontrar uma doula
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Explorar primeiro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
