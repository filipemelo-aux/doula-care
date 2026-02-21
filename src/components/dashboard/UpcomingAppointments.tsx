import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trash2, Loader2, Plus, Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ManageAppointmentsDialog } from "@/components/clients/ManageAppointmentsDialog";

interface AppointmentWithClient {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  client_id: string;
  clients: {
    full_name: string;
  };
}

export function UpcomingAppointments() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["all-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .gte("scheduled_at", new Date().toISOString().split("T")[0])
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as unknown as AppointmentWithClient[];
    },
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover consulta");
    } else {
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.success("Consulta removida");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Consultas Agendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : appointments && appointments.length > 0 ? (
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-2 pr-2">
                {appointments.map((apt) => {
                  const date = new Date(apt.scheduled_at);
                  const today = isToday(date);

                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-lg p-3 border bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div className="text-center min-w-[44px]">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(date, "MMM", { locale: ptBR })}
                        </p>
                        <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{apt.title}</p>
                          {today && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Hoje
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {apt.clients?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(date, "EEEE, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setSelectedClient({ id: apt.client_id, name: apt.clients?.full_name })
                          }
                          title="Gerenciar consultas"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(apt.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma consulta agendada
            </p>
          )}
        </CardContent>
      </Card>

      {selectedClient && (
        <ManageAppointmentsDialog
          open={!!selectedClient}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedClient(null);
              queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
            }
          }}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
        />
      )}
    </>
  );
}
