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
      .select("id, title, scheduled_at, notes")
      .eq("client_id", clientId)
      .not("title", "like", "Serviço:%")
      .gte("scheduled_at", new Date().toISOString().split("T")[0])
      .order("scheduled_at", { ascending: true })
      .limit(5);

    setAppointments(data || []);
  };

  if (appointments.length === 0) return null;

  return (
    <Card className="overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="font-display font-semibold text-base">Minhas Consultas</h2>
        </div>

        <div className="space-y-2">
          {appointments.map((apt) => {
            const date = new Date(apt.scheduled_at);
            const today = isToday(date);

            return (
              <div
                key={apt.id}
                className={`flex items-start gap-3 rounded-lg p-3 ${
                  today
                    ? "bg-blue-100/80 border border-blue-300"
                    : "bg-background/60"
                }`}
              >
                <div className="text-center min-w-[48px]">
                  <p className="text-xs text-muted-foreground uppercase">
                    {format(date, "MMM", { locale: ptBR })}
                  </p>
                  <p className="text-lg font-bold text-blue-700">
                    {format(date, "dd")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm break-words">{apt.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(date, "EEEE, HH:mm", { locale: ptBR })}
                  </p>
                  {apt.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">{apt.notes}</p>
                  )}
                </div>
                {today && (
                  <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">
                    Hoje
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
