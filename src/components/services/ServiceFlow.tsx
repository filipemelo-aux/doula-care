import { Check, Circle, FileText, HandCoins, HeartHandshake, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export type ServiceStage = "contract" | "performed" | "forecast" | "invoiced" | "paid";

const stages = [
  { id: "contract", label: "Acompanhamento", icon: HeartHandshake },
  { id: "performed", label: "Atendimento", icon: Stethoscope },
  { id: "forecast", label: "A faturar", icon: Circle },
  { id: "invoiced", label: "Faturado", icon: FileText },
  { id: "paid", label: "Pago", icon: HandCoins },
] as const;

const stageIndex = (stage: ServiceStage) => stages.findIndex((item) => item.id === stage);

export function ServiceFlow({ current, compact = false }: { current: ServiceStage; compact?: boolean }) {
  const currentIndex = stageIndex(current);
  return (
    <div className={cn("grid grid-cols-5", compact ? "gap-1" : "gap-2")} aria-label={`Etapa atual: ${stages[currentIndex]?.label}`}>
      {stages.map((stage, index) => {
        const complete = index < currentIndex || current === "paid";
        const active = index === currentIndex && current !== "paid";
        const Icon = complete ? Check : stage.icon;
        return (
          <div key={stage.id} className="relative flex min-w-0 flex-col items-center text-center">
            {index > 0 && (
              <span className={cn("absolute right-1/2 top-3 h-px w-full", index <= currentIndex ? "bg-success/60" : "bg-border")} />
            )}
            <span className={cn(
              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-card transition-colors",
              complete && "border-success bg-success text-success-foreground",
              active && "border-primary bg-primary text-primary-foreground",
              !complete && !active && "border-border text-muted-foreground"
            )}>
              <Icon className="h-3 w-3" strokeWidth={2.2} />
            </span>
            {!compact && <span className={cn("mt-1.5 text-[10px] leading-tight", index <= currentIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{stage.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function ServiceWorkspaceNav({ active, onNavigate }: { active: "followups" | "records" | "forecasts"; onNavigate: (path: string) => void }) {
  const items = [
    { id: "followups", label: "Acompanhamentos", path: "/servicos/acompanhamentos" },
    { id: "records", label: "Atendimentos", path: "/servicos/atendimentos" },
    { id: "forecasts", label: "A faturar", path: "/servicos/previsoes" },
  ] as const;
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1" aria-label="Etapas dos serviços">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.path)}
          className={cn(
            "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors",
            active === item.id ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}