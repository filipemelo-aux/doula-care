import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useNavigate } from "react-router-dom";
import { PREGNANCY_WEEKS, getWeekInfo } from "@/lib/pregnancyWeeks";
import { cn } from "@/lib/utils";

interface PregnancyHeroCarouselProps {
  /** Current pregnancy week (1-40). If null/undefined, defaults to 12. */
  currentWeek?: number | null;
}

/**
 * Premium pregnancy carousel for the visitor home.
 * - Horizontal swipe with snap, lateral cards visible & scaled down
 * - Floating animation on the active card image
 * - Opens already centered on the user's current week
 */
export function PregnancyHeroCarousel({ currentWeek }: PregnancyHeroCarouselProps) {
  const navigate = useNavigate();
  const initialIndex = useMemo(() => {
    const w = currentWeek && currentWeek >= 1 && currentWeek <= 40 ? currentWeek : 12;
    return w - 1;
  }, [currentWeek]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    startIndex: initialIndex,
    skipSnaps: false,
    dragFree: true,
    loop: true,
  });

  const [selected, setSelected] = useState(initialIndex);
  const [snapsInView, setSnapsInView] = useState<number[]>([]);
  const tweenNodes = useRef<HTMLElement[]>([]);

  // Apply scale tween to slides based on distance from selected
  useEffect(() => {
    if (!emblaApi) return;

    const setTweenNodes = () => {
      tweenNodes.current = emblaApi
        .slideNodes()
        .map((s) => s.querySelector(".embla-slide__inner") as HTMLElement);
    };

    const tween = () => {
      const engine = emblaApi.internalEngine();
      const scrollProgress = emblaApi.scrollProgress();
      const slidesInView = emblaApi.slidesInView();

      emblaApi.scrollSnapList().forEach((snap, idx) => {
        let diffToTarget = snap - scrollProgress;
        const slidesInSnap = engine.slideRegistry[idx];

        slidesInSnap.forEach((slideIdx) => {
          if (!slidesInView.includes(slideIdx)) return;

          // Loop edge correction (not used since we don't loop, kept for safety)
          if (engine.options.loop) {
            engine.slideLooper.loopPoints.forEach((loopItem) => {
              const target = loopItem.target();
              if (slideIdx === loopItem.index && target !== 0) {
                const sign = Math.sign(target);
                if (sign === -1) diffToTarget = snap - (1 + scrollProgress);
                if (sign === 1) diffToTarget = snap + (1 - scrollProgress);
              }
            });
          }

          const tweenValue = 1 - Math.abs(diffToTarget) * 0.18;
          const scale = Math.max(0.86, Math.min(1, tweenValue));
          const opacity = Math.max(0.55, Math.min(1, 1 - Math.abs(diffToTarget) * 0.45));
          const node = tweenNodes.current[slideIdx];
          if (node) {
            node.style.transform = `scale(${scale})`;
            node.style.opacity = `${opacity}`;
          }
        });
      });
    };

    setTweenNodes();
    tween();
    emblaApi.on("reInit", setTweenNodes);
    emblaApi.on("reInit", tween);
    emblaApi.on("scroll", tween);
    emblaApi.on("slideFocus", tween);

    const onSelect = () => {
      setSelected(emblaApi.selectedScrollSnap());
      setSnapsInView(emblaApi.slidesInView());
    };
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("scroll", tween);
      emblaApi.off("reInit", tween);
      emblaApi.off("reInit", setTweenNodes);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
      emblaApi.off("slideFocus", tween);
    };
  }, [emblaApi]);

  // If currentWeek changes after mount (e.g., DPP set), recenter
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(initialIndex, true);
  }, [emblaApi, initialIndex]);

  const activeWeek = getWeekInfo(selected + 1);
  const total = PREGNANCY_WEEKS.length;

  return (
    <div className="-mx-4">
      {/* Header */}
      <div className="px-4 mb-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-primary/80 font-semibold">
            Sua gestação
          </p>
          <h2 className="font-display font-bold text-lg leading-tight">
            Acompanhe cada fase do seu bebê 💗
          </h2>
        </div>
        <button
          onClick={() => navigate("/visitante/gestacao")}
          className="text-xs font-medium text-primary shrink-0 ml-2"
        >
          Ver todas
        </button>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y -ml-3 pl-2 pr-2">
          {PREGNANCY_WEEKS.map((w) => {
            const isActive = w.week === selected + 1;
            return (
              <div
                key={w.week}
                className="shrink-0 grow-0 basis-[82%] sm:basis-[60%] md:basis-[48%] lg:basis-[38%] pl-3"
              >
                <div
                  className={cn(
                    "embla-slide__inner will-change-transform transition-[transform,opacity] duration-300 ease-out",
                  )}
                  style={{ transformOrigin: "center center" }}
                >
                  <button
                    onClick={() => {
                      if (isActive) navigate(`/visitante/gestacao/semana/${w.week}`);
                      else emblaApi?.scrollTo(w.week - 1);
                    }}
                    className={cn(
                      "w-full text-left rounded-3xl overflow-hidden relative",
                      "bg-gradient-to-br from-secondary via-secondary/70 to-primary/15",
                      "dark:from-primary/15 dark:via-primary/10 dark:to-accent/10",
                      "shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.35)]",
                      "p-5 min-h-[320px] flex flex-col",
                    )}
                  >
                    {/* Top row: badge + fruit name */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-background/80 backdrop-blur px-3 py-1.5 shadow-sm">
                        <p className="text-xl font-display font-bold text-primary leading-none">
                          {w.week}ª
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          semana
                        </p>
                      </div>
                      <div className="text-right max-w-[58%]">
                        <p className="text-[10px] text-foreground/70 leading-tight">
                          Seu bebê é do tamanho de um
                        </p>
                        <p className="font-display font-bold text-lg text-primary capitalize leading-tight mt-0.5 break-words">
                          {w.fruit_name}
                        </p>
                      </div>

                    </div>

                    {/* Hero baby image */}
                    <div className="relative flex-1 flex items-center justify-center my-2 min-h-[150px]">
                      {w.baby_image ? (
                        <img
                          src={w.baby_image}
                          alt={`Ilustração do bebê na ${w.week}ª semana ao lado de ${w.fruit_name}`}
                          loading={isActive ? "eager" : "lazy"}
                          className={cn(
                            "w-full h-[180px] object-contain select-none pointer-events-none drop-shadow-[0_8px_20px_hsl(var(--primary)/0.25)]",
                            isActive && "animate-[heroBreath_3s_ease-in-out_infinite]",
                          )}
                          draggable={false}
                        />
                      ) : (
                        <div className="text-[88px] leading-none select-none" aria-hidden>
                          {w.fruit_emoji}
                        </div>
                      )}
                      {/* soft glow */}
                      <div className="absolute inset-0 -z-10 bg-gradient-radial from-primary/15 via-transparent to-transparent blur-2xl" />
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center justify-around bg-background/70 backdrop-blur rounded-2xl px-3 py-2 mb-2">
                      <div className="text-center">
                        <p className="font-display font-bold text-sm text-foreground">
                          {w.baby_size_cm}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          tamanho
                        </p>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="text-center">
                        <p className="font-display font-bold text-sm text-foreground">
                          {w.baby_weight}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          peso
                        </p>
                      </div>
                    </div>

                    {/* Emotional text */}
                    <p className="text-xs text-foreground/80 text-center leading-relaxed line-clamp-2">
                      {w.description}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="px-4 mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
            style={{ width: `${((selected + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground font-medium tabular-nums shrink-0">
          {selected + 1} de {total} semanas
        </p>
      </div>

      {/* Floating animation keyframes */}
      <style>{`
        @keyframes heroBreath {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
