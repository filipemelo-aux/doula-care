import { Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InAppAnnouncementDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  closing?: boolean;
}

export function InAppAnnouncementDialog({ open, title, message, onClose, closing = false }: InAppAnnouncementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !closing) onClose(); }}>
      <DialogContent className="max-w-md" onPointerDownOutside={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader className="space-y-3 text-center sm:text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-primary">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Megaphone className="h-5 w-5" /></span>
            Doula Care · Aviso
          </div>
          <DialogTitle className="break-words text-center text-lg leading-snug">{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap break-words text-center text-sm leading-relaxed">{message}</DialogDescription>
        </DialogHeader>
        <Button onClick={onClose} disabled={closing} className="mt-2 w-full">
          {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}