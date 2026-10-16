import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Mensagem exibida (uma vez por dia) quando o trial de 15 dias termina
 * e a doula ainda não assinou. Os limites do Free já ficam aplicados.
 */
export function TrialEndedDialog() {
  const { organizationId, user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["trial-15d-ended", organizationId, user?.id],
    enabled: !!organizationId && !!user?.id && !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!organizationId || !user) return null;
      const { data: promo } = await supabase
        .from("org_promotions" as any)
        .select("id, status, trial_ends_at")
        .eq("organization_id", organizationId)
        .eq("promotion_type", "trial_15d")
        .maybeSingle();
      const p = promo as any;
      if (!p?.trial_ends_at) return null;
      const ended =
        p.status === "expired" ||
        (p.status === "trial_active" && new Date(p.trial_ends_at) < new Date());
      if (!ended) return null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (sub) return null;
      return p.id as string;
    },
  });

  useEffect(() => {
    if (!data || location.pathname.includes("/admin/assinatura")) return;
    const key = `trial-ended-seen-${data}`;
    const today = new Date().toDateString();
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    setOpen(true);
  }, [data, location.pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          Enquanto você não assina, sua conta segue no plano Free, com os limites dele.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              setOpen(false);
              navigate("/admin/assinatura");
            }}
          >
            Escolher meu plano ✨
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
