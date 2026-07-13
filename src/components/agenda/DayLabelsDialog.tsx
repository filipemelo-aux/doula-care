import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tag, Trash2, Loader2, Plus } from "lucide-react";
import { useCalendarLabels } from "@/hooks/useCalendarLabels";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  date: Date | null;
  onOpenLabelsManager?: () => void;
}

export function DayLabelsDialog({ open, onOpenChange, organizationId, date, onOpenLabelsManager }: Props) {
  const {
    labels,
    dayMap,
    assignDayLabel,
    removeDayLabel,
    updateDayLabelNote,
  } = useCalendarLabels(organizationId);

  const dayKey = date ? format(date, "yyyy-MM-dd") : "";
  const assignments = dayMap.get(dayKey) || [];

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const drafts: Record<string, string> = {};
    assignments.forEach((a) => {
      drafts[a.id] = a.note || "";
    });
    setNoteDrafts(drafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, assignments.length]);

  if (!date) return null;

  const assignedLabelIds = new Set(assignments.map((a) => a.label_id));
  const availableLabels = labels.filter((l) => !assignedLabelIds.has(l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Etiquetas do dia
          </DialogTitle>
          <DialogDescription className="text-xs">
            {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Assigned labels */}
          {assignments.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Marcações neste dia
              </p>
              {assignments.map((a) => (
                <div key={a.id} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: a.label?.color || "#999" }}
                    />
                    <span className="text-sm font-medium flex-1 truncate">
                      {a.label?.name || "Etiqueta removida"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeDayLabel.mutate(a.id)}
                      disabled={removeDayLabel.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Anotação (opcional)</Label>
                    <Textarea
                      value={noteDrafts[a.id] ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))
                      }
                      onBlur={() => {
                        const newVal = noteDrafts[a.id] ?? "";
                        if (newVal !== (a.note || "")) {
                          updateDayLabelNote.mutate({ id: a.id, note: newVal || null });
                        }
                      }}
                      rows={2}
                      placeholder="Adicione uma nota..."
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add label */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Adicionar etiqueta
            </p>
            {labels.length === 0 ? (
              <div className="text-center py-4 rounded-xl bg-muted/40 space-y-2">
                <p className="text-xs text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
                {onOpenLabelsManager && (
                  <Button size="sm" variant="outline" onClick={onOpenLabelsManager}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Criar etiqueta
                  </Button>
                )}
              </div>
            ) : availableLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Todas as suas etiquetas já estão neste dia.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableLabels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => assignDayLabel.mutate({ day: dayKey, labelId: l.id })}
                    disabled={assignDayLabel.isPending}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-transform hover:scale-105 disabled:opacity-50"
                    )}
                    style={{
                      backgroundColor: `${l.color}22`,
                      borderColor: `${l.color}55`,
                      color: l.color,
                    }}
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onOpenLabelsManager && labels.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onOpenLabelsManager}>
              <Tag className="h-3.5 w-3.5 mr-1" /> Gerenciar etiquetas
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
