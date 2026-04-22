import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";
import { setGuestProfile, type GuestProfile } from "@/lib/guestVisitor";
import { toast } from "sonner";

interface GuestWelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: GuestProfile;
  onSaved: (next: GuestProfile) => void;
}

/**
 * Friendly first-visit modal for anonymous visitors. Collects name,
 * preferred name, DPP and WhatsApp so the app feels personalized right away.
 */
export function GuestWelcomeDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: GuestWelcomeDialogProps) {
  const [fullName, setFullName] = useState(initial.full_name || "");
  const [preferredName, setPreferredName] = useState(initial.preferred_name || "");
  const [dpp, setDpp] = useState(initial.dpp || "");
  const [phone, setPhone] = useState(initial.phone || "");

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSave = () => {
    if (!fullName.trim()) {
      toast.error("Por favor, conta seu nome 💗");
      return;
    }
    const next: GuestProfile = {
      ...initial,
      full_name: fullName.trim(),
      preferred_name: preferredName.trim() || fullName.trim().split(" ")[0],
      dpp: dpp || null,
      phone: phone.trim() || null,
    };
    setGuestProfile(next);
    onSaved(next);
    toast.success(`Que prazer te conhecer, ${next.preferred_name}! 💗`, {
      position: "top-center",
      duration: 2500,
    });
    onOpenChange(false);
  };

  const handleSkip = () => {
    // Mark as seen even if skipped so we don't pester on every reload.
    setGuestProfile({ ...initial, _welcomed: true } as GuestProfile);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); else onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          </div>
          <DialogTitle className="text-center font-display text-lg">
            Boas-vindas! Vamos nos conhecer? 💗
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Conta um pouquinho sobre você para deixarmos o app pronto pra te receber com carinho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="welcome-name" className="text-xs">Seu nome completo</Label>
            <Input
              id="welcome-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Maria da Silva"
              className="h-11"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="welcome-preferred" className="text-xs">Como gostaria de ser chamada?</Label>
            <Input
              id="welcome-preferred"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="Ex: Mari"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="welcome-dpp" className="text-xs">Data provável do parto (DPP)</Label>
            <Input
              id="welcome-dpp"
              type="date"
              value={dpp}
              onChange={(e) => setDpp(e.target.value)}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Não sabe ao certo? Tudo bem, pode ajustar depois.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="welcome-phone" className="text-xs">WhatsApp</Label>
            <Input
              id="welcome-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="h-11"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button className="w-full h-11" onClick={handleSave}>
            Salvar e começar
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleSkip}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
