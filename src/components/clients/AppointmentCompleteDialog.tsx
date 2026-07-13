import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface AppointmentCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  appointmentTitle: string;
  onCompleted: () => void;
  /** When true, appointment is already completed and we're only editing notes. */
  editMode?: boolean;
  /** Existing completion notes to prefill (edit or add-more). */
  initialNotes?: string | null;
}

export function AppointmentCompleteDialog({
  open,
  onOpenChange,
  appointmentId,
  appointmentTitle,
  onCompleted,
  editMode = false,
  initialNotes = null,
}: AppointmentCompleteDialogProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setNotes(initialNotes || "");
  }, [open, initialNotes]);

  const handleSave = async () => {
    setLoading(true);
    const payload: Record<string, unknown> = {
      completion_notes: notes || null,
    };
    if (!editMode) {
      payload.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", appointmentId);

    setLoading(false);
    if (error) {
      toast.error(editMode ? "Erro ao salvar anotações" : "Erro ao concluir compromisso");
    } else {
      toast.success(editMode ? "Anotações salvas!" : "Compromisso concluído!");
      onOpenChange(false);
      onCompleted();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {editMode ? (
              <>
                <Pencil className="h-5 w-5 text-primary" />
                Editar Anotações
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Concluir Compromisso
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Compromisso</p>
            <p className="text-sm font-medium break-words">{appointmentTitle}</p>
          </div>

          <div>
            <Label className="text-xs">
              {editMode ? "Anotações do compromisso" : "Anotações do compromisso (opcional)"}
            </Label>
            <Textarea
              placeholder="Anotações sobre o compromisso, evolução da gestante, orientações dadas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="mt-1"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : editMode ? (
              <Pencil className="h-4 w-4 mr-1" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            {editMode ? "Salvar Anotações" : "Concluir Compromisso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
