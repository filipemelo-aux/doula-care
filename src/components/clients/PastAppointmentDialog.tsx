import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PastAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
}

/**
 * Registers an already-performed appointment (retroactive) directly from the
 * client file, so historic consultations don't need to be created in the agenda.
 */
export function PastAppointmentDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: PastAppointmentDialogProps) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("Consulta");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("Consulta");
      setDate("");
      setTime("09:00");
      setNotes("");
    }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim().slice(0, 120);
      if (!cleanTitle) throw new Error("Informe o tipo de atendimento");
      if (!date) throw new Error("Informe a data do atendimento");

      const scheduledUtc = fromZonedTime(
        `${date}T${time || "09:00"}`,
        "America/Sao_Paulo"
      ).toISOString();

      const { error } = await supabase.from("appointments").insert({
        client_id: clientId,
        title: cleanTitle,
        scheduled_at: scheduledUtc,
        notes: notes.trim().slice(0, 1000) || null,
        completed_at: scheduledUtc,
        completion_notes: notes.trim().slice(0, 1000) || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-file-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.success("Atendimento registrado na ficha!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar atendimento"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[18px]">
        <DialogHeader>
          <DialogTitle>Registrar atendimento realizado</DialogTitle>
          <DialogDescription>
            Adicione consultas já realizadas{clientName ? ` com ${clientName}` : ""} sem
            precisar criá-las na agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de atendimento</Label>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consulta pré-natal, visita domiciliar"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Anotações</Label>
            <Textarea
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que foi trabalhado nesse atendimento"
              className="text-sm min-h-[90px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
