import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Plus, Trash2, Loader2, Eye } from "lucide-react";
import { AppointmentDetailDialog } from "@/components/clients/AppointmentDetailDialog";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ManageAppointmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

interface Appointment {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
}

export function ManageAppointmentsDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ManageAppointmentsDialogProps) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [detailApt, setDetailApt] = useState<Appointment | null>(null);
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["client-appointments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: open && !!clientId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").insert({
        client_id: clientId,
        title,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes: notes || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-appointments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      setTitle("");
      setScheduledAt("");
      setNotes("");
      toast.success("Consulta agendada!");
    },
    onError: () => toast.error("Erro ao agendar consulta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-appointments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.success("Consulta removida");
    },
    onError: () => toast.error("Erro ao remover consulta"),
  });

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Consultas - {clientName.split(" ")[0]}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-4 pr-2">
            {/* Add form */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  placeholder="Ex: Consulta pré-natal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  onInput={(e) => setScheduledAt((e.target as HTMLInputElement).value)}
                  onBlur={(e) => setScheduledAt(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea
                  placeholder="Observações..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!title || !scheduledAt || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Agendar Consulta
              </Button>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const past = isPast(apt.scheduled_at);
                  const date = new Date(apt.scheduled_at);

                  return (
                    <div
                      key={apt.id}
                      className={`flex w-full max-w-full min-w-0 items-center gap-3 rounded-lg p-3 border overflow-hidden ${
                        past ? "opacity-50 bg-muted/20" : "bg-background"
                      }`}
                    >
                      <div className="text-center min-w-[40px]">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(date, "MMM", { locale: ptBR })}
                        </p>
                        <p className="text-base font-bold">{format(date, "dd")}</p>
                      </div>
                      <div className="w-0 flex-1 overflow-hidden">
                        <p className="block w-full font-medium text-sm truncate" title={apt.title}>{apt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(date, "EEEE, HH:mm", { locale: ptBR })}
                        </p>
                        {apt.notes && (
                          <p className="text-xs text-muted-foreground truncate">{apt.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
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
                          className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => deleteMutation.mutate(apt.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma consulta agendada
              </p>
            )}
          </div>
        </ScrollArea>

        <AppointmentDetailDialog
          open={!!detailApt}
          onOpenChange={(open) => !open && setDetailApt(null)}
          appointment={detailApt ? {
            title: detailApt.title,
            scheduled_at: detailApt.scheduled_at,
            notes: detailApt.notes,
          } : null}
        />
      </DialogContent>
    </Dialog>
  );
}
