import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Users, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Mensagem exibida (uma vez por dia) quando o trial de 15 dias termina
 * e a doula ainda não assinou. Os limites do Free já ficam aplicados.
 */
export function TrialEndedDialog() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { trialNoticeId, isLoading } = usePlanLimits();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const noticeKey = trialNoticeId && user ? `trial-ended-notice-v2-${user.id}-${trialNoticeId}` : null;

  useEffect(() => {
    if (isLoading) return;
    if (!noticeKey || !isAdmin || isSuperAdmin) { setOpen(false); return; }
    const today = new Date().toDateString();
    try { if (localStorage.getItem(noticeKey) === today) return; } catch {}
    setOpen(true);
  }, [noticeKey, isLoading, isAdmin, isSuperAdmin]);

  const acknowledge = () => {
    if (noticeKey) {
      try { localStorage.setItem(noticeKey, new Date().toDateString()); } catch {}
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) acknowledge(); }}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader className="items-center text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <Heart className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-xl text-center">
            Que alegria ter você com a gente! 💛
          </DialogTitle>
          <DialogDescription className="text-sm text-center leading-relaxed">
            Seu teste chegou ao fim, e esperamos que o Doula Care já tenha deixado sua
            rotina mais leve e organizada. 🌸 Para continuar cuidando das suas clientes com todos os
            recursos, escolha agora o plano que combina com você!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-left">
          <div className="rounded-xl bg-muted/50 p-3 flex gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Pro</strong> — perfeito para quem atende sozinha e quer tudo organizado.
            </p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 flex gap-3">
            <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Trabalha com equipe?</strong> O <strong>Premium</strong> é para você: inclua
              suas parceiras e colaboradoras no mesmo painel. 🤝
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Seus dados continuam guardados com carinho. Enquanto você não assina, sua conta
          segue no Free, com os recursos e limites disponíveis nesse plano.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              acknowledge();
              navigate("/admin/assinatura");
            }}
          >
            Escolher meu plano ✨
          </Button>
          <Button variant="ghost" onClick={acknowledge}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
