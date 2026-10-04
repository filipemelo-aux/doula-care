import { useNavigate } from "react-router-dom";
import { Check, Clock, Hourglass, CalendarPlus, HeartHandshake } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn, formatBrazilDateTime } from "@/lib/utils";
import { useClientPlan } from "@/lib/clientPlan";

export function MyPlanConsultationsCard({ clientId, onRequest }: { clientId: string; onRequest?: (sequence: number, name: string) => void }) {
  const navigate = useNavigate();
  const { data } = useClientPlan(clientId);
  if (!data) return null;
  const { planName, consultations } = data;
  const done = consultations.filter((c) => c.state === "done").length;

  const request = (seq: number, name: string) => {
    if (onRequest) onRequest(seq, name);
    else navigate(`/gestante/consultas?consulta=${seq}`);
  };

  return (
    <div className="rounded-2xl bg-card shadow-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <HeartHandshake className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Meu plano</p>
          <h2 className="font-semibold text-base text-foreground truncate">{planName}</h2>
        </div>
        {consultations.length > 0 && (
          <span className="text-xs font-medium text-primary">{done}/{consultations.length}</span>
        )}
      </div>

      {consultations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Seu plano ainda não tem consultas definidas pela sua doula.</p>
      ) : (
        <div className="space-y-2">
          {consultations.map((c) => (
            <div key={c.sequence} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  c.state === "done" && "bg-success text-success-foreground",
                  c.state === "scheduled" && "bg-primary/15 text-primary",
                  c.state === "requested" && "bg-accent text-accent-foreground",
                  c.state === "available" && "bg-card text-muted-foreground"
                )}
              >
                {c.state === "done" ? <Check className="h-3.5 w-3.5" /> : c.state === "scheduled" ? <Clock className="h-3.5 w-3.5" /> : c.state === "requested" ? <Hourglass className="h-3.5 w-3.5" /> : c.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.state === "done" && "Realizada"}
                  {c.state === "scheduled" && (c.scheduledAt ? `Agendada · ${formatBrazilDateTime(c.scheduledAt, "dd/MM 'às' HH:mm")}` : "Agendada")}
                  {c.state === "requested" && c.requestedFor && `Aguardando a doula · ${format(new Date(c.requestedFor), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                  {c.state === "available" && "Disponível para agendar"}
                </p>
              </div>
              {c.state === "available" && (
                <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => request(c.sequence, c.name)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Solicitar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
