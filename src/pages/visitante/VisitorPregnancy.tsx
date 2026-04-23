import { useEffect, useMemo, useState } from "react";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getGuestProfile } from "@/lib/guestVisitor";
import { getLocalDate } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { PREGNANCY_WEEKS, getWeekInfo } from "@/lib/pregnancyWeeks";
import { Baby, ChevronLeft, ChevronRight, Sparkles, Ruler, Scale, Heart, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VisitorPregnancy() {
  const { user } = useAuth();
  const isGuest = !user;
  const [dpp, setDpp] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Carrega DPP da gestante (autenticada ou visitante)
  useEffect(() => {
    if (isGuest) {
      setDpp(getGuestProfile().dpp || null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("dpp")
        .eq("user_id", user!.id)
        .maybeSingle();
      setDpp(data?.dpp || null);
    })();
  }, [isGuest, user]);

  const currentWeek = useMemo(() => {
    if (!dpp) return null;
    const dppDate = getLocalDate(dpp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDpp = differenceInDays(dppDate, today);
    const totalDays = 280;
    const daysPregnant = totalDays - daysUntilDpp;
    if (daysPregnant < 0) return 1;
    if (daysPregnant > 280) return 40;
    return Math.max(1, Math.floor(daysPregnant / 7) + 1);
  }, [dpp]);

  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek ?? 12);

  useEffect(() => {
    if (currentWeek) setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const week = getWeekInfo(selectedWeek);
  const trimester = selectedWeek <= 13 ? "1º trimestre" : selectedWeek <= 27 ? "2º trimestre" : "3º trimestre";

  const goPrev = () => {
    if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
      setAnimKey((k) => k + 1);
    }
  };
  const goNext = () => {
    if (selectedWeek < 40) {
      setSelectedWeek(selectedWeek + 1);
      setAnimKey((k) => k + 1);
    }
  };

  const progress = (selectedWeek / 40) * 100;

  return (
    <VisitorLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center space-y-1 pt-1">
          <h1 className="font-display font-bold text-xl flex items-center justify-center gap-2">
            <Baby className="h-5 w-5 text-primary" />
            Acompanhe sua gestação
          </h1>
          <p className="text-xs text-muted-foreground">
            {currentWeek
              ? <>Você está na <span className="font-semibold text-primary">semana {currentWeek}</span> · {trimester}</>
              : "Explore semana a semana o desenvolvimento do bebê"}
          </p>
        </div>

        {/* Card principal */}
        <Card className="overflow-hidden border-0 shadow-card">
          <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-6">
            <div
              key={animKey}
              className="flex flex-col items-center text-center animate-fade-in"
            >
              {/* Imagem/Emoji da fruta */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-background/70 backdrop-blur-sm shadow-card flex items-center justify-center text-7xl animate-scale-in">
                  {week.fruit_emoji}
                </div>
                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-bold shadow-md">
                  {week.week}ª semana
                </div>
              </div>

              {/* Texto principal */}
              <p className="mt-5 text-base text-muted-foreground">
                Seu bebê está do tamanho de um(a)
              </p>
              <p className="font-display font-bold text-2xl text-primary mt-1 capitalize">
                {week.fruit_name}
              </p>

              {/* Métricas */}
              <div className="grid grid-cols-2 gap-3 w-full mt-5">
                <div className="rounded-xl bg-background/60 p-3 flex flex-col items-center">
                  <Ruler className="h-4 w-4 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tamanho</p>
                  <p className="text-sm font-semibold mt-0.5">{week.baby_size_cm}</p>
                </div>
                <div className="rounded-xl bg-background/60 p-3 flex flex-col items-center">
                  <Scale className="h-4 w-4 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Peso</p>
                  <p className="text-sm font-semibold mt-0.5">{week.baby_weight}</p>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* Descrição */}
            <div key={`desc-${animKey}`} className="animate-fade-in flex gap-3">
              <Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" fill="currentColor" />
              <p className="text-sm leading-relaxed text-foreground/90">{week.description}</p>
            </div>

            {/* Dica */}
            <div
              key={`tip-${animKey}`}
              className="animate-fade-in rounded-xl bg-accent/10 border border-accent/20 p-3 flex gap-3"
            >
              <Lightbulb className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground/80 mb-0.5">
                  Dica da Doula
                </p>
                <p className="text-sm leading-relaxed">{week.tip}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navegação Anterior/Próxima */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={selectedWeek <= 1}
            className="h-11"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <Button
            onClick={goNext}
            disabled={selectedWeek >= 40}
            className="h-11"
          >
            Próxima <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Slider + progresso */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Navegue pelas semanas</p>
              <span className="text-xs font-semibold text-primary">{selectedWeek}/40</span>
            </div>
            <Slider
              value={[selectedWeek]}
              min={1}
              max={40}
              step={1}
              onValueChange={(v) => {
                setSelectedWeek(v[0]);
                setAnimKey((k) => k + 1);
              }}
            />
            {/* Indicador de progresso visual */}
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1º tri</span>
                <span>2º tri</span>
                <span>3º tri</span>
                <span>Bebê 💗</span>
              </div>
            </div>
            {currentWeek && currentWeek !== selectedWeek && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSelectedWeek(currentWeek);
                  setAnimKey((k) => k + 1);
                }}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Voltar para minha semana atual
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Mini grid de semanas */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Toque em qualquer semana</p>
            <div className="grid grid-cols-8 gap-1.5">
              {PREGNANCY_WEEKS.map((w) => (
                <button
                  key={w.week}
                  onClick={() => {
                    setSelectedWeek(w.week);
                    setAnimKey((k) => k + 1);
                  }}
                  className={cn(
                    "aspect-square rounded-lg text-[11px] font-semibold transition-all active:scale-90",
                    w.week === selectedWeek
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : currentWeek && w.week === currentWeek
                      ? "bg-accent/30 text-accent-foreground ring-1 ring-accent"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {w.week}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {!dpp && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Defina sua DPP no perfil para ver automaticamente a sua semana atual destacada. 💗
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </VisitorLayout>
  );
}
