import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    title: string;
    scheduled_at: string;
    notes?: string | null;
    clientName?: string;
  } | null;
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
}: AppointmentDetailDialogProps) {
  if (!appointment) return null;

  const date = new Date(appointment.scheduled_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalhes da Consulta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Título</p>
            <p className="text-sm font-medium break-words">{appointment.title}</p>
          </div>

          {appointment.clientName && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cliente</p>
              <p className="text-sm break-words">{appointment.clientName}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Data e Hora
            </p>
            <p className="text-sm">
              {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {" às "}
              {format(date, "HH:mm", { locale: ptBR })}
            </p>
          </div>

          {appointment.notes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Observações
              </p>
              <p className="text-sm break-words whitespace-pre-wrap">{appointment.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
