import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarCheck, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  available_date: string;
  start_time: string;
  end_time: string;
}

export function AvailabilityManager() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  const { data: availability, isLoading } = useQuery({
    queryKey: ["doula-availability", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doula_availability")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("available_date", { ascending: true });
      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!organizationId,
  });

  const availableDates = new Set(
    (availability || []).map((a) => a.available_date)
  );

  const selectedDaySlots = (availability || []).filter(
    (a) => a.available_date === format(selectedDate, "yyyy-MM-dd")
  );

  const addSlotMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("doula_availability").insert({
        organization_id: organizationId!,
        available_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      setAddSlotOpen(false);
      toast.success("Horário adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar horário"),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("doula_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      toast.success("Horário removido!");
    },
    onError: () => toast.error("Erro ao remover horário"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Disponibilidade
        </CardTitle>
        <p className="text-xs text-muted-foreground">Selecione um dia e adicione seus horários disponíveis</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ptBR}
              className="pointer-events-auto w-full"
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              modifiers={{
                available: (date) => availableDates.has(format(date, "yyyy-MM-dd")),
              }}
              modifiersClassNames={{
                available: "available-day",
              }}
            />
            <style>{`
              .available-day {
                position: relative;
                background-color: hsl(var(--primary) / 0.15) !important;
                font-weight: 600;
              }
              .available-day::after {
                content: '';
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background-color: hsl(var(--primary));
              }
            `}</style>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </h4>
              <Button size="sm" variant="outline" onClick={() => setAddSlotOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Horário
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedDaySlots.length > 0 ? (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {selectedDaySlots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between rounded-lg p-3 border bg-background">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteSlotMutation.mutate(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum horário disponível neste dia
              </p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Add Slot Dialog */}
      <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Adicionar Horário
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addSlotMutation.mutate()}
              disabled={!startTime || !endTime || startTime >= endTime || addSlotMutation.isPending}
              className="w-full"
            >
              {addSlotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
