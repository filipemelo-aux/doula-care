import { useMemo } from "react";
import { format, addDays, isToday, isTomorrow, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarLabels } from "@/hooks/useCalendarLabels";
import { Tag } from "lucide-react";

/**
 * Compact card showing the next 14 days of labeled calendar days.
 * Only renders when there are any upcoming labels.
 */
export function CalendarLabelsSummaryCard() {
  const { organizationId } = useAuth();
  const { dayMap } = useCalendarLabels(organizationId);

  const upcoming = useMemo(() => {
    const start = startOfDay(new Date());
    const rows: { date: Date; labels: ReturnType<typeof dayMap.get> }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(start, i);
      const key = format(d, "yyyy-MM-dd");
      const labels = dayMap.get(key);
      if (labels && labels.length > 0) {
        rows.push({ date: d, labels });
      }
    }
    return rows;
  }, [dayMap]);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-semibold text-lg text-foreground">Etiquetas do calendário</h2>
      </div>

      <div className="max-h-[220px] overflow-y-auto -mr-1 pr-1">
        <div className="space-y-2">
          {upcoming.map(({ date, labels }) => {
            const key = format(date, "yyyy-MM-dd");
            const dayTag = isToday(date)
              ? "Hoje"
              : isTomorrow(date)
                ? "Amanhã"
                : format(date, "EEE", { locale: ptBR });
            return (
              <div key={key} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                <div className="text-center min-w-[44px]">
                  <p className="text-[10px] text-muted-foreground/60 uppercase">
                    {format(date, "MMM", { locale: ptBR })}
                  </p>
                  <p className="text-lg font-bold leading-tight text-foreground">
                    {format(date, "dd")}
                  </p>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{dayTag}</p>
                  <div className="flex flex-wrap gap-1">
                    {(labels || []).map((d) => (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${d.label?.color || "#999"}22`,
                          color: d.label?.color || "#666",
                        }}
                        title={d.note || undefined}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: d.label?.color || "#999" }}
                        />
                        {d.label?.name || "Etiqueta"}
                      </span>
                    ))}
                  </div>
                  {(labels || []).some((d) => d.note) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(labels || []).filter((d) => d.note).map((d) => d.note).join(" • ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
