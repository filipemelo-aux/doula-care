import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb, Ruler, Scale, Search } from "lucide-react";
import { getWeekInfo } from "@/lib/pregnancyWeeks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";

export default function VisitorWeekDetail() {
  const { week: weekParam } = useParams<{ week: string }>();
  const navigate = useNavigate();

  const week = Math.max(1, Math.min(40, Number(weekParam) || 1));
  const info = getWeekInfo(week);
  const trimester = week <= 13 ? "1º trimestre" : week <= 27 ? "2º trimestre" : "3º trimestre";

  const goPrev = () => week > 1 && navigate(`/visitante/gestacao/semana/${week - 1}`);
  const goNext = () => week < 40 && navigate(`/visitante/gestacao/semana/${week + 1}`);

  return (
    <VisitorLayout>
    <div className="min-h-full pb-8">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/visitante")}
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Button>
          <p className="text-xs text-muted-foreground font-medium">{trimester}</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pt-4">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-[hsl(20_60%_96%)] via-[hsl(15_70%_93%)] to-[hsl(10_60%_90%)] dark:from-primary/15 dark:via-primary/10 dark:to-accent/10 shadow-[0_12px_40px_-16px_hsl(var(--primary)/0.4)] p-5 relative">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-primary/80 font-semibold">
                Sua gestação
              </p>
              <h1 className="font-display font-bold text-3xl text-foreground leading-tight">
                {week}ª semana
              </h1>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-foreground/70">Tamanho de um</p>
              <p className="font-display font-bold text-xl text-primary capitalize leading-tight mt-0.5">
                {info.fruit_name}
              </p>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-2 min-h-[240px]">
            {info.baby_image ? (
              <img
                src={info.baby_image}
                alt={`Ilustração do bebê na ${week}ª semana ao lado de ${info.fruit_name}`}
                className="w-full max-w-[340px] h-[260px] object-contain animate-[heroBreath_3s_ease-in-out_infinite] drop-shadow-[0_10px_28px_hsl(var(--primary)/0.3)]"
                draggable={false}
              />
            ) : (
              <div className="text-[140px]" aria-hidden>
                {info.fruit_emoji}
              </div>
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-around bg-background/75 backdrop-blur rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-primary/10 p-2">
                <Ruler className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-foreground leading-none">
                  {info.baby_size_cm}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  tamanho
                </p>
              </div>
            </div>
            <div className="h-9 w-px bg-border" />
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-primary/10 p-2">
                <Scale className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-foreground leading-none">
                  {info.baby_weight}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  peso
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 mt-5">
        <h2 className="font-display font-bold text-lg mb-2">Como está o seu bebê</h2>
        <p className="text-sm text-foreground/85 leading-relaxed">{info.description}</p>
      </div>

      {/* Tip */}
      <div className="px-4 mt-5">
        <div className="rounded-2xl bg-accent/15 border border-accent/30 p-4 flex gap-3">
          <div className="rounded-full bg-accent/25 p-2 h-fit">
            <Lightbulb className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-accent-foreground/80 mb-1">
              Dica da doula
            </p>
            <p className="text-sm text-foreground/85 leading-relaxed">{info.tip}</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 mt-5">
        <Button
          size="lg"
          className="w-full gap-2 h-12 rounded-2xl shadow-[0_8px_24px_-10px_hsl(var(--primary)/0.5)]"
          onClick={() => navigate("/visitante/buscar")}
        >
          <Search className="h-4 w-4" />
          Encontrar doulas para essa fase
        </Button>
      </div>

      {/* Prev / Next */}
      <div className="px-4 mt-5 flex items-center gap-2">
        <Button
          variant="outline"
          className={cn("flex-1 gap-1.5 rounded-2xl", week === 1 && "opacity-40 pointer-events-none")}
          onClick={goPrev}
          disabled={week === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Semana {week - 1 || 1}
        </Button>
        <Button
          variant="outline"
          className={cn("flex-1 gap-1.5 rounded-2xl", week === 40 && "opacity-40 pointer-events-none")}
          onClick={goNext}
          disabled={week === 40}
        >
          Semana {Math.min(40, week + 1)}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <style>{`
        @keyframes heroBreath {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
