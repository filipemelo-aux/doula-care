import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Trash2, Loader2, Plus, Clock, Eye } from "lucide-react";
import { AppointmentDetailDialog } from "@/components/clients/AppointmentDetailDialog";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { abbreviateName } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [pickClientOpen, setPickClientOpen] = useState(false);
  const [pickedClientId, setPickedClientId] = useState("");
  const [detailApt, setDetailApt] = useState<AppointmentWithClient | null>(null);

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

  const { data: clients } = useQuery({
    queryKey: ["clients-for-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, user_id")
        .not("user_id", "is", null)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: pickClientOpen,
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

  const handlePickClient = () => {
    const client = clients?.find((c) => c.id === pickedClientId);
    if (client) {
      setPickClientOpen(false);
      setPickedClientId("");
      setSelectedClient({ id: client.id, name: client.full_name });
    }
  };

  const displayName = (name: string) => {
    const parts = name.split(" ");
    if (parts.length <= 3) return name;
    // Keep first 2, abbreviate middle ones, keep last
    const first = parts.slice(0, 2);
    const middle = parts.slice(2, -1);
    const last = parts[parts.length - 1];
    const prefixes = ["de", "da", "do", "dos", "das", "e", "del", "della", "di"];
    const abbreviated = middle.map((p) => (prefixes.includes(p.toLowerCase()) ? p : `${p[0]}.`));
    return [...first, ...abbreviated, last].join(" ");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Consultas Agendadas
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setPickClientOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {isMobile ? "Consulta" : "Nova Consulta"}
            </Button>
          </div>
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
                      className="flex w-full max-w-full min-w-0 items-center gap-3 rounded-lg p-3 border bg-background hover:bg-muted/30 transition-colors overflow-hidden"
                    >
                      <div className="text-center min-w-[44px]">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(date, "MMM", { locale: ptBR })}
                        </p>
                        <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
                      </div>
                      <div className="w-0 flex-1 overflow-hidden">
                        <p className="block w-full font-medium text-sm truncate" title={apt.title}>{apt.title}</p>
                        <p className="text-xs text-muted-foreground truncate" title={apt.clients?.full_name}>
                          {displayName(apt.clients?.full_name || "")}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate min-w-0">{format(date, "EEEE, HH:mm", { locale: ptBR })}</span>
                          {today && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0 ml-1">
                              Hoje
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setDetailApt(apt)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Pick client dialog */}
      <Dialog open={pickClientOpen} onOpenChange={setPickClientOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Selecionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={pickedClientId} onValueChange={setPickedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={!pickedClientId} onClick={handlePickClient}>
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      <AppointmentDetailDialog
        open={!!detailApt}
        onOpenChange={(open) => !open && setDetailApt(null)}
        appointment={detailApt ? {
          title: detailApt.title,
          scheduled_at: detailApt.scheduled_at,
          notes: detailApt.notes,
          clientName: detailApt.clients?.full_name,
        } : null}
      />
    </>
  );
}
