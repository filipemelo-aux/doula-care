import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Trash2, Loader2, Clock, CheckCircle, MapPin, CalendarCheck, Plus, Briefcase } from "lucide-react";
import { AppointmentDetailDialog } from "@/components/clients/AppointmentDetailDialog";
import { AppointmentCompleteDialog } from "@/components/clients/AppointmentCompleteDialog";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ManageAppointmentsDialog } from "@/components/clients/ManageAppointmentsDialog";


interface AppointmentWithClient {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  client_id: string;
  address?: string | null;
  clients: {
    full_name: string;
  };
}

export function UpcomingAppointments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [pickClientOpen, setPickClientOpen] = useState(false);
  const [pickedClientId, setPickedClientId] = useState("");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["all-appointments"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        
        .is("completed_at", null)
        .gte("scheduled_at", todayStart.toISOString())
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
    const first = parts.slice(0, 2);
    const middle = parts.slice(2, -1);
    const last = parts[parts.length - 1];
    const prefixes = ["de", "da", "do", "dos", "das", "e", "del", "della", "di"];
    const abbreviated = middle.map((p) => (prefixes.includes(p.toLowerCase()) ? p : `${p[0]}.`));
    return [...first, ...abbreviated, last].join(" ");
  };

  return (
    <>
      <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">Compromissos Agendados</h2>
          <div className="ml-auto flex items-center gap-2">
            {appointments && appointments.length > 0 && (
              <span className="text-2xl font-bold text-foreground">{appointments.length}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/agenda", { state: { openDialog: "consulta" } })} className="gap-2.5 py-2.5">
                  <Calendar className="h-4 w-4" /> Nova consulta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agenda", { state: { openDialog: "compromisso" } })} className="gap-2.5 py-2.5">
                  <CalendarCheck className="h-4 w-4" /> Novo compromisso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agenda", { state: { openDialog: "servico" } })} className="gap-2.5 py-2.5">
                  <Briefcase className="h-4 w-4" /> Novo serviço
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : appointments && appointments.length > 0 ? (
          <div className="max-h-[180px] overflow-y-auto overflow-x-visible -mr-1 pr-1">
            <div className="space-y-2">
              {appointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  apt={apt}
                  displayName={displayName}
                  onDelete={handleDelete}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ["all-appointments"] })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum compromisso agendado</p>
          </div>
        )}
      </div>

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
    </>
  );
}

/* ── Individual appointment card — matching Agenda's AppointmentRow style ── */
function AppointmentCard({
  apt,
  displayName,
  onDelete,
  onRefresh,
}: {
  apt: AppointmentWithClient;
  displayName: (name: string) => string;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [editNotesOpen, setEditNotesOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const date = new Date(apt.scheduled_at);
  const today = isToday(date);

  return (
    <>
      <Card
        onClick={() => setDetailOpen(true)}
        className={`px-3 py-2.5 space-y-1.5 w-full box-border min-w-0 overflow-hidden cursor-pointer transition-colors hover:bg-muted/40 ${apt.completed_at ? "opacity-70" : ""}`}
      >
        {/* Header: date column + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center min-w-[44px] flex-shrink-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase">
              {format(date, "MMM", { locale: ptBR })}
            </p>
            <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm truncate" title={apt.title}>{apt.title}</p>
              {apt.completed_at && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 text-success px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
                  <CheckCircle className="h-2.5 w-2.5" /> Concluída
                </span>
              )}
            </div>
            {apt.clients?.full_name ? (
              <p className="text-xs text-muted-foreground truncate">{displayName(apt.clients.full_name)}</p>
            ) : (
              <p className="text-xs text-muted-foreground/60 truncate italic">Compromisso pessoal</p>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {format(date, "EEEE, HH:mm", { locale: ptBR })}
          </span>
          {today && (
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
              Hoje
            </span>
          )}
        </div>

        {apt.notes && <p className="text-xs text-muted-foreground/80 line-clamp-2 whitespace-pre-wrap" title={apt.notes}>{apt.notes}</p>}
        {apt.address && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate" title={apt.address}>
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{apt.address}</span>
          </p>
        )}
        {apt.completion_notes && (
          <p className="text-xs text-primary line-clamp-2 whitespace-pre-wrap" title={apt.completion_notes}>📝 {apt.completion_notes}</p>
        )}

        {/* Route shortcut only — all other actions live inside the detail dialog */}
        {apt.address && (
          <div className="flex items-center pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => {
                const query = encodeURIComponent(apt.address!);
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
              }}
              className="h-8 px-3 gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-none transition-all"
            >
              <MapPin className="h-3.5 w-3.5" />
              Rota
            </Button>
          </div>
        )}
      </Card>

      <AppointmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={{
          title: apt.title,
          scheduled_at: apt.scheduled_at,
          notes: apt.notes,
          clientName: apt.clients?.full_name,
          completed_at: apt.completed_at,
          completion_notes: apt.completion_notes,
        }}
        onEdit={() => navigate("/agenda", { state: { editAppointmentId: apt.id } })}
        onEditNotes={() => setEditNotesOpen(true)}
        onComplete={() => setCompleteOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
      />

      <AppointmentCompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        appointmentId={apt.id}
        appointmentTitle={apt.title}
        onCompleted={onRefresh}
      />

      <AppointmentCompleteDialog
        open={editNotesOpen}
        onOpenChange={setEditNotesOpen}
        appointmentId={apt.id}
        appointmentTitle={apt.title}
        editMode
        initialNotes={apt.completion_notes}
        onCompleted={onRefresh}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta consulta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteConfirmOpen(false);
                onDelete(apt.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
