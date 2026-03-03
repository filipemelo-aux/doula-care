import { useState } from "react";
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
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AppointmentCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  appointmentTitle: string;
  onCompleted: () => void;
}

export function AppointmentCompleteDialog({
  open,
  onOpenChange,
  appointmentId,
  appointmentTitle,
  onCompleted,
}: AppointmentCompleteDialogProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        completed_at: new Date().toISOString(),
        completion_notes: notes || null,
      })
      .eq("id", appointmentId);

    setLoading(false);
    if (error) {
      toast.error("Erro ao concluir consulta");
    } else {
      toast.success("Consulta concluída!");
      setNotes("");
      onOpenChange(false);
      onCompleted();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Concluir Consulta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Consulta</p>
            <p className="text-sm font-medium break-words">{appointmentTitle}</p>
          </div>

          <div>
            <Label className="text-xs">Observações da consulta (opcional)</Label>
            <Textarea
              placeholder="Anotações sobre a consulta, evolução da gestante, orientações dadas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Concluir Consulta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
