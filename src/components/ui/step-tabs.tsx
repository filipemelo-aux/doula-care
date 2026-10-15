import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepTab = {
  id: number;
  label: string;
  done?: boolean;
  error?: boolean;
  disabled?: boolean;
};

/** Abas de etapas clicáveis, alinhadas à esquerda — a pessoa pode ir e voltar em qualquer etapa. */
export function StepTabs({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: StepTab[];
  current: number;
  onSelect: (id: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-start gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-0.5 px-0.5">
        {steps.map((s, i) => {
          const active = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              disabled={s.disabled}
              onClick={() => onSelect(s.id)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[11px] sm:text-xs font-medium transition-all active:scale-95",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : s.error
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                  : s.done
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                s.disabled && "opacity-40 cursor-not-allowed hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  active
                    ? "bg-primary-foreground/20"
                    : s.error
                    ? "bg-destructive/15"
                    : s.done
                    ? "bg-primary/15"
                    : "bg-background"
                )}
              >
                {s.error && !active ? (
                  <AlertCircle className="h-3 w-3" />
                ) : s.done && !active ? (
                  <Check className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-left text-[10px] text-muted-foreground">
        Toque em qualquer etapa para preencher ou corrigir.
      </p>
    </div>
  );
}
