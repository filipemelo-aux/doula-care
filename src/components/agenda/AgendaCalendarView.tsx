import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarAppointment {
  id: string;
  title: string;
  scheduled_at: string;
  completed_at: string | null;
  clients: { full_name: string };
}

interface AgendaCalendarViewProps {
  appointments: CalendarAppointment[];
  onDateSelect?: (date: Date) => void;
}

export function AgendaCalendarView({ appointments, onDateSelect }: AgendaCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get dates that have appointments
  const datesWithAppointments = new Set(
    appointments.map((apt) => format(new Date(apt.scheduled_at), "yyyy-MM-dd"))
  );

  const selectedDayAppointments = appointments.filter((apt) =>
    isSameDay(new Date(apt.scheduled_at), selectedDate)
  );

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onDateSelect?.(date);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ptBR}
            className="pointer-events-auto w-full"
            modifiers={{
              hasAppointment: (date) =>
                datesWithAppointments.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              hasAppointment: "has-appointment",
            }}
          />
          <style>{`
            .has-appointment::after {
              content: '';
              position: absolute;
              bottom: 2px;
              left: 50%;
              transform: translateX(-50%);
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background-color: hsl(var(--primary));
            }
            .has-appointment {
              position: relative;
            }
          `}</style>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-display font-semibold text-sm mb-3">
            {format(selectedDate, "dd 'de' MMMM, EEEE", { locale: ptBR })}
          </h3>
          {selectedDayAppointments.length > 0 ? (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {selectedDayAppointments.map((apt) => {
                  const date = new Date(apt.scheduled_at);
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "rounded-lg p-3 border bg-background",
                        apt.completed_at && "opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm flex-1 truncate">{apt.title}</p>
                        {apt.completed_at && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-0.5" /> Concluída
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{apt.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {format(date, "HH:mm")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum compromisso neste dia
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
