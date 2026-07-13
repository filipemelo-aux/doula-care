import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, FileText, CheckCircle, Edit2, NotebookPen, Trash2 } from "lucide-react";
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
    completed_at?: string | null;
    completion_notes?: string | null;
  } | null;
  onEdit?: () => void;
  onEditNotes?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onEditNotes,
  onComplete,
  onDelete,
}: AppointmentDetailDialogProps) {
  if (!appointment) return null;

  const date = new Date(appointment.scheduled_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalhes do Compromisso
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

          {appointment.completed_at && (
            <div className="p-3 rounded-lg bg-green-50">
              <p className="text-xs text-green-700 mb-1 flex items-center gap-1 font-medium">
                <CheckCircle className="h-3 w-3" /> Consulta Concluída
              </p>
              <p className="text-xs text-green-600">
                {format(new Date(appointment.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              {appointment.completion_notes && (
                <p className="text-sm break-words whitespace-pre-wrap mt-2 text-green-800">{appointment.completion_notes}</p>
              )}
            </div>
          )}
        </div>

        {(onEdit || onEditNotes || onComplete || onDelete) && (
          <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-col sm:space-x-0">
            {onComplete && !appointment.completed_at && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onComplete();
                }}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Concluir consulta
              </Button>
            )}
            {onEditNotes && appointment.completed_at && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEditNotes();
                }}
                className="gap-1.5 w-full"
              >
                <NotebookPen className="h-3.5 w-3.5" />
                Editar anotações
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
                className="gap-1.5 w-full"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar compromisso
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete();
                }}
                className="gap-1.5 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
