import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { GuestSignupPrompt } from "@/components/visitante/GuestSignupPrompt";
import { GuestWelcomeDialog } from "@/components/visitante/GuestWelcomeDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Baby,
  Calendar,
  Loader2,
  Search,
  Timer,
  Clock,
  XCircle,
  Sparkles,
  ChevronRight,
  BookHeart,
  CircleUserRound,
  X,
  CheckCircle2,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLocalDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getGuestProfile, setGuestProfile as saveGuestProfile, type GuestProfile } from "@/lib/guestVisitor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PregnancyHeroCarousel } from "@/components/visitante/PregnancyHeroCarousel";
import { GuestIntroDialog } from "@/components/visitante/GuestIntroDialog";

const GUEST_INTRO_KEY = "guest_intro_seen_v1";

export default function VisitorDashboard() {
  const { user, client } = useAuth();
  const navigate = useNavigate();
  const isGuest = !user;
  const [clientData, setClientData] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isGuest);
  const [signupPromptOpen, setSignupPromptOpen] = useState(false);
  const [guestProfile, setGuestProfile] = useState<GuestProfile>(() => getGuestProfile());
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  // Auto-open the interactive welcome on the first guest visit.
  useEffect(() => {
    if (!isGuest) return;
    try {
      const seen = localStorage.getItem(GUEST_INTRO_KEY);
      if (!seen) {
        const t = setTimeout(() => setIntroOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, [isGuest]);

  const handleCloseIntro = (open: boolean) => {
    setIntroOpen(open);
    if (!open) {
      try { localStorage.setItem(GUEST_INTRO_KEY, "1"); } catch { /* noop */ }
    }
  };

  useEffect(() => {
    if (!user) {
      setGuestProfile(getGuestProfile());
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setClientData(data);
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setAvatarUrl(profile?.avatar_url || null);
      setLoading(false);
    })();
  }, [user]);

  // Active match request (only for authenticated visitors)
  const { data: activeRequest } = useQuery({
    queryKey: ["my-match-request", user?.id],
    enabled: !!user?.id,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("doula_match_requests" as any)
        .select("*, organizations(name, nome_exibicao)")
        .eq("visitor_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const dismissKey = activeRequest?.id ? `match-banner-dismissed-${activeRequest.id}` : null;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    if (!dismissKey) { setBannerDismissed(false); return; }
    setBannerDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  const dismissBanner = () => {
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setBannerDismissed(true);
  };

  useEffect(() => {
    if (activeRequest?.status === "approved" && !bannerDismissed) {
      const reloadKey = `match-approved-reloaded-${activeRequest.id}`;
      if (!localStorage.getItem(reloadKey)) {
        localStorage.setItem(reloadKey, "1");
        toast.success("Sua doula aprovou seu vínculo!", { description: "Atualizando sua área..." });
        setTimeout(() => window.location.reload(), 1500);
      }
    }
  }, [activeRequest?.status, activeRequest?.id, bannerDismissed]);

  const effectiveData = isGuest ? guestProfile : clientData;

  const calculateGestationalAge = () => {
    if (!effectiveData?.dpp) return null;
    const dppDate = getLocalDate(effectiveData.dpp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDpp = differenceInDays(dppDate, today);
    const totalDays = 280;
    const daysPregnant = totalDays - daysUntilDpp;
    if (daysPregnant < 0 || daysPregnant > 294) return null;
    const weeks = Math.floor(daysPregnant / 7);
    const days = daysPregnant % 7;
    return { weeks, days, daysUntilDpp };
  };

  const gestationalAge = calculateGestationalAge();
  const displayName =
    (effectiveData as any)?.preferred_name ||
    (effectiveData as any)?.full_name?.split(" ")[0] ||
    "visitante";

  const handleSearchDoula = () => {
    if (!isGuest && activeRequest?.status === "pending") return;
    navigate("/visitante/buscar");
  };

  if (loading) {
    return (
      <VisitorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout avatarUrl={avatarUrl} greetingName={displayName}>
      <div className="space-y-4 overflow-x-hidden">
        {/* Premium pregnancy carousel — top of home */}
        <PregnancyHeroCarousel currentWeek={gestationalAge?.weeks ?? null} />

        {/* Greeting */}
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 shadow-md">
            <AvatarImage src={avatarUrl || undefined} alt="Perfil" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="font-display font-bold text-base">{displayName}!</h1>
          </div>
        </div>

        {/* Guest welcome banner */}
        {isGuest && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Bem-vinda à Doula Care 💗</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Você pode explorar livremente. Quando quiser encontrar uma doula perto de você,
                  é só criar sua conta gratuita.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match request banners (auth only) */}
        {!isGuest && activeRequest?.status === "pending" && !bannerDismissed && (
          <Card className="border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Aguardando resposta da doula</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Você solicitou o plano <strong>{activeRequest.plan_name}</strong> com{" "}
                  <strong>
                    {activeRequest.organizations?.nome_exibicao || activeRequest.organizations?.name}
                  </strong>
                  . Você será notificada assim que ela responder.
                </p>
              </div>
              <button
                onClick={dismissBanner}
                aria-label="Fechar aviso"
                className="shrink-0 -mr-1 -mt-1 h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}
        {!isGuest && activeRequest?.status === "approved" && !bannerDismissed && (
          <Card className="border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Vínculo aprovado! 💗</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sua doula <strong>{activeRequest.organizations?.nome_exibicao || activeRequest.organizations?.name}</strong> aprovou seu vínculo.
                </p>
              </div>
              <button
                onClick={dismissBanner}
                aria-label="Fechar aviso"
                className="shrink-0 -mr-1 -mt-1 h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}
        {!isGuest && activeRequest?.status === "rejected" && !bannerDismissed && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Solicitação anterior recusada</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Toque em "Buscar" abaixo para escolher outra doula.
                </p>
              </div>
              <button
                onClick={dismissBanner}
                aria-label="Fechar aviso"
                className="shrink-0 -mr-1 -mt-1 h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Pregnancy Progress */}
        {gestationalAge ? (
          <div className="rounded-2xl bg-card shadow-card overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Baby className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold text-base">Sua Gestação</h2>
              </div>
              <div className="text-center py-3">
                <p className="text-4xl font-display font-bold text-primary">
                  {gestationalAge.weeks}
                  <span className="text-2xl">s</span>
                  {gestationalAge.days > 0 && <span className="text-2xl">{gestationalAge.days}d</span>}
                </p>
                <p className="text-muted-foreground text-sm mt-1">semanas de gestação</p>
              </div>
              <div className="flex items-center justify-between bg-background/60 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">DPP:</span>
                </div>
                <span className="font-semibold">
                  {effectiveData?.dpp && format(getLocalDate(effectiveData.dpp), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              {gestationalAge.daysUntilDpp > 0 && gestationalAge.daysUntilDpp <= 60 && (
                <div className="text-center mt-3 text-xs text-muted-foreground">
                  🎉 Faltam apenas{" "}
                  <span className="font-semibold text-primary">{gestationalAge.daysUntilDpp}</span> dias!
                </div>
              )}
            </div>
          </div>
        ) : isGuest ? (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Baby className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-base">Quando seu bebê vai chegar? 💗</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Conta pra gente sua DPP (data provável do parto) e a gente acompanha cada semaninha com você.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-dpp" className="text-xs">Data provável do parto</Label>
                <Input
                  id="guest-dpp"
                  type="date"
                  value={guestProfile.dpp || ""}
                  onChange={(e) => {
                    const next = { ...guestProfile, dpp: e.target.value || null };
                    setGuestProfile(next);
                    saveGuestProfile(next);
                    if (e.target.value) {
                      toast.success("DPP salva! 💗", {
                        description: "Agora você verá o progresso da sua gestação.",
                        position: "top-center",
                        duration: 2200,
                      });
                    }
                  }}
                  className="input-field h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  Não sabe ao certo? Sem problemas, você pode ajustar depois no seu perfil.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Atualize sua DPP no perfil para ver o progresso da sua gestação.
            </CardContent>
          </Card>
        )}

        {/* Minha Gestação - Timeline semanal */}
        <button
          onClick={() => navigate("/visitante/gestacao")}
          className="w-full text-left rounded-2xl bg-card shadow-card overflow-hidden hover:shadow-[var(--shadow-card-hover)] transition-all active:scale-[0.99]"
        >
          <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 text-2xl">
              🍓
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-base">Minha Gestação</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe semana a semana o tamanho e desenvolvimento do bebê.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          </div>
        </button>

        {/* Contractions card */}
        <button
          onClick={() => navigate("/visitante/contracoes")}
          className="w-full text-left rounded-2xl bg-card shadow-card overflow-hidden hover:shadow-[var(--shadow-card-hover)] transition-all active:scale-[0.99]"
        >
          <div className="bg-gradient-to-br from-warning/10 to-warning/5 p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-warning/15 flex items-center justify-center shrink-0">
              <Timer className="h-6 w-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-base">Cronômetro de contrações</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comece a registrar e acompanhar suas contrações.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          </div>
        </button>

        {/* CTA buscar doula */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-primary" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-semibold">Está precisando de uma doula?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Encontre profissionais perto de você, conheça os planos e solicite o vínculo.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full h-11"
              onClick={handleSearchDoula}
              disabled={!isGuest && activeRequest?.status === "pending"}
            >
              <Search className="h-4 w-4 mr-2" /> Buscar uma doula
            </Button>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate("/visitante/diario")}
            className="rounded-2xl bg-card p-4 shadow-card flex items-center gap-3 text-left hover:shadow-[var(--shadow-card-hover)] transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
              <BookHeart className="h-5 w-5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Diário</p>
              <p className="text-xs text-muted-foreground truncate">Seus momentos</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/visitante/perfil")}
            className="rounded-2xl bg-card p-4 shadow-card flex items-center gap-3 text-left hover:shadow-[var(--shadow-card-hover)] transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CircleUserRound className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Meu perfil</p>
              <p className="text-xs text-muted-foreground truncate">Dados pessoais</p>
            </div>
          </button>
        </div>

        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm mb-1">Como funciona</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Encontre uma doula, escolha um plano e solicite o vínculo. Após aprovado, você passa a ter
                acompanhamento completo. 💗
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <GuestSignupPrompt
        open={signupPromptOpen}
        onOpenChange={setSignupPromptOpen}
      />

      {isGuest && (
        <GuestWelcomeDialog
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          initial={guestProfile}
          onSaved={(next) => setGuestProfile(next)}
        />
      )}
    </VisitorLayout>
  );
}
