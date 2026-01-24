import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodOption = "month" | "quarter" | "semester" | "year";

interface PeriodFilterProps {
  selected: PeriodOption;
  onChange: (period: PeriodOption) => void;
}

export function getPeriodDates(period: PeriodOption): { start: Date; end: Date } {
  const now = new Date();
  
  switch (period) {
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "semester":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfMonth(now) };
  }
}

export function getPeriodLabel(period: PeriodOption): string {
  const { start, end } = getPeriodDates(period);
  
  switch (period) {
    case "month":
      return format(start, "MMMM 'de' yyyy", { locale: ptBR });
    case "quarter":
      return `${format(start, "MMM", { locale: ptBR })} - ${format(end, "MMM yyyy", { locale: ptBR })}`;
    case "semester":
      return `${format(start, "MMM", { locale: ptBR })} - ${format(end, "MMM yyyy", { locale: ptBR })}`;
    case "year":
      return format(start, "yyyy");
  }
}

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "quarter", label: "Trimestre" },
  { value: "semester", label: "Semestre" },
  { value: "year", label: "Ano" },
];

export function PeriodFilter({ selected, onChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-muted-foreground" />
      <div className="flex bg-muted/50 rounded-lg p-1">
        {periodOptions.map((option) => (
          <Button
            key={option.value}
            variant={selected === option.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(option.value)}
            className={selected === option.value 
              ? "bg-primary text-primary-foreground" 
              : "text-muted-foreground hover:text-foreground"
            }
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
