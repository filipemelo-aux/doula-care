import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronRight } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  completed_at: string | null;
}

interface AppointmentsCardProps {
  clientId: string;
}

export function AppointmentsCard({ clientId }: AppointmentsCardProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel(`appointments-${clientId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `client_id=eq.${clientId}`,
      }, () => fetchAppointments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, notes, completed_at")
      .eq("client_id", clientId)
      .not("title", "like", "Serviço:%")
      .is("completed_at", null)
      .gte("scheduled_at", new Date().toISOString().split("T")[0])
      .order("scheduled_at", { ascending: true })
      .limit(5);

    setAppointments(data || []);
  };

  if (appointments.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-semibold text-base text-foreground">Minhas Consultas</h2>
      </div>

      <div className="space-y-2">
        {appointments.map((apt) => {
          const date = new Date(apt.scheduled_at);
          const today = isToday(date);

          return (
            <div
              key={apt.id}
              className={`flex items-start gap-3 rounded-xl p-3 ${
                today ? "bg-primary/8" : "bg-muted/50"
              }`}
            >
              <div className="text-center min-w-[44px]">
                <p className="text-[10px] text-muted-foreground/60 uppercase">
                  {format(date, "MMM", { locale: ptBR })}
                </p>
                <p className="text-lg font-bold leading-tight text-foreground">
                  {format(date, "dd")}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm break-words">{apt.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(date, "EEEE, HH:mm", { locale: ptBR })}
                </p>
                {apt.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words whitespace-pre-wrap line-clamp-3">{apt.notes}</p>
                )}
              </div>
              {today && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
                  Hoje
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
