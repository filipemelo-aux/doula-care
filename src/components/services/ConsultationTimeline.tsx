import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsultationStep } from "@/lib/consultations";

export function ConsultationTimeline({ steps }: { steps: ConsultationStep[] }) {
  return (
    <div className="flex items-center" aria-label="Linha do tempo das consultas">
      {steps.map((s, i) => (
        <div key={s.sequence} className="flex flex-1 items-center last:flex-none">
          <span
            title={`Consulta ${s.sequence} · ${s.label}`}
            className={cn(
              "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
              s.state === "done" && "border-success bg-success text-success-foreground",
              s.state === "scheduled" && "border-primary bg-primary/15 text-primary",
              s.state === "pending" && "border-border bg-card text-muted-foreground"
            )}
          >
            {s.state === "done" ? <Check className="h-3 w-3" /> : s.state === "scheduled" ? <Clock className="h-3 w-3" /> : s.sequence}
          </span>
          {i < steps.length - 1 && <span className={cn("h-px flex-1", s.state === "done" ? "bg-success/60" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}
