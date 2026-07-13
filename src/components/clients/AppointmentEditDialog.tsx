import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

interface AppointmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    title: string;
    scheduled_at: string;
    notes: string | null;
    address: string | null;
  } | null;
  clientName: string;
  onSaved: () => void;
}

const TIMEZONE = "America/Sao_Paulo";

export function AppointmentEditDialog({
  open,
  onOpenChange,
  appointment,
  clientName,
  onSaved,
}: AppointmentEditDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    if (open && appointment) {
      setTitle(appointment.title);
      const zoned = toZonedTime(new Date(appointment.scheduled_at), TIMEZONE);
      setDate(format(zoned, "yyyy-MM-dd"));
      setTime(format(zoned, "HH:mm"));
      setNotes(appointment.notes || "");
      setAddress(appointment.address || "");
      setIsLocal(!appointment.address);
    }
  }, [open, appointment]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("No appointment");
      const scheduledUtc = fromZonedTime(`${date}T${time}`, TIMEZONE).toISOString();
      const finalAddress = isLocal ? null : address.trim() || null;
      const { error } = await supabase
        .from("appointments")
        .update({
          title: title.trim(),
          scheduled_at: scheduledUtc,
          notes: notes.trim() || null,
          address: finalAddress,
        })
        .eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Consulta atualizada!");
      onOpenChange(false);
      onSaved();
    },
    onError: () => toast.error("Erro ao atualizar consulta"),
  });

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Editar Consulta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Cliente</Label>
            <p className="text-sm text-muted-foreground mt-1">{clientName}</p>
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              placeholder="Ex: Consulta pré-natal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Anotações sobre a consulta..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-local"
              checked={isLocal}
              onCheckedChange={(checked) => setIsLocal(checked === true)}
            />
            <Label htmlFor="is-local" className="text-xs cursor-pointer">
              Atendimento local (sem endereço)
            </Label>
          </div>
          {!isLocal && (
            <div>
              <Label className="text-xs">Endereço / local</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
                placeholder="Digite o endereço ou local"
              />
            </div>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || !date || !time || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
