import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarCheck, Plus, Trash2, Loader2, Clock, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  available_date: string;
  start_time: string;
  end_time: string;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 to 20:00

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function AvailabilityManager() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // For single-day add: selected hour toggles
  const [selectedStartHours, setSelectedStartHours] = useState<number[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  // For batch apply
  const [batchDates, setBatchDates] = useState<Date[]>([]);
  const [batchStartHours, setBatchStartHours] = useState<number[]>([]);
  const [batchSelectionStart, setBatchSelectionStart] = useState<number | null>(null);
  const [showBatchCalendar, setShowBatchCalendar] = useState(false);

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

  // Convert selected hours into periods (contiguous ranges)
  function hoursToPeriods(hours: number[]): { start: string; end: string }[] {
    if (hours.length === 0) return [];
    const sorted = [...hours].sort((a, b) => a - b);
    const periods: { start: string; end: string }[] = [];
    let periodStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== prev + 1) {
        periods.push({ start: formatHour(periodStart), end: formatHour(prev + 1) });
        periodStart = sorted[i];
      }
      prev = sorted[i];
    }
    periods.push({ start: formatHour(periodStart), end: formatHour(prev + 1) });
    return periods;
  }

  // Toggle hour selection with shift-click range support
  function toggleHour(hour: number, hours: number[], setHours: (h: number[]) => void, selStart: number | null, setSelStart: (n: number | null) => void) {
    if (hours.includes(hour)) {
      setHours(hours.filter((h) => h !== hour));
      setSelStart(null);
    } else {
      if (selStart !== null) {
        // Fill range
        const min = Math.min(selStart, hour);
        const max = Math.max(selStart, hour);
        const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        setHours([...new Set([...hours, ...range])]);
        setSelStart(null);
      } else {
        setHours([...hours, hour]);
        setSelStart(hour);
      }
    }
  }

  const addSlotMutation = useMutation({
    mutationFn: async (periods: { start: string; end: string }[]) => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const inserts = periods.map((p) => ({
        organization_id: organizationId!,
        available_date: dateStr,
        start_time: p.start,
        end_time: p.end,
      }));
      const { error } = await supabase.from("doula_availability").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      setAddSlotOpen(false);
      setSelectedStartHours([]);
      setSelectionStart(null);
      toast.success("Horários adicionados!");
    },
    onError: () => toast.error("Erro ao adicionar horários"),
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const periods = hoursToPeriods(batchStartHours);
      const dateStrings = batchDates.map((d) => format(d, "yyyy-MM-dd"));

      // First, delete existing availability for all selected dates
      for (const dateStr of dateStrings) {
        const { error: delError } = await supabase
          .from("doula_availability")
          .delete()
          .eq("organization_id", organizationId!)
          .eq("available_date", dateStr);
        if (delError) throw delError;
      }

      // Then insert new slots
      const inserts = dateStrings.flatMap((dateStr) =>
        periods.map((p) => ({
          organization_id: organizationId!,
          available_date: dateStr,
          start_time: p.start,
          end_time: p.end,
        }))
      );
      if (inserts.length === 0) return;
      const { error } = await supabase.from("doula_availability").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      setBatchDialogOpen(false);
      setBatchDates([]);
      setBatchStartHours([]);
      setBatchSelectionStart(null);
      toast.success(`Horários aplicados para ${batchDates.length} dia(s)!`);
    },
    onError: () => toast.error("Erro ao aplicar horários em lote"),
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

  const deleteDayMutation = useMutation({
    mutationFn: async (dateStr: string) => {
      const { error } = await supabase
        .from("doula_availability")
        .delete()
        .eq("organization_id", organizationId!)
        .eq("available_date", dateStr);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      toast.success("Todos os horários do dia removidos!");
    },
    onError: () => toast.error("Erro ao remover horários"),
  });

  const today = startOfDay(new Date());

  const periods = hoursToPeriods(selectedStartHours);
  const batchPeriods = hoursToPeriods(batchStartHours);

  // Open add dialog and pre-fill with existing slots
  function openAddSlotDialog() {
    // Pre-select hours from existing slots
    const existingHours: number[] = [];
    selectedDaySlots.forEach((slot) => {
      const start = parseInt(slot.start_time.split(":")[0]);
      const end = parseInt(slot.end_time.split(":")[0]);
      for (let h = start; h < end; h++) existingHours.push(h);
    });
    setSelectedStartHours([]);
    setSelectionStart(null);
    setAddSlotOpen(true);
  }

  function openBatchDialog() {
    setBatchDates([]);
    setBatchStartHours([]);
    setBatchSelectionStart(null);
    setShowBatchCalendar(false);
    setBatchDialogOpen(true);
  }

  // Copy current day's hours to batch
  function copyCurrentDayToBatch() {
    const existingHours: number[] = [];
    selectedDaySlots.forEach((slot) => {
      const start = parseInt(slot.start_time.split(":")[0]);
      const end = parseInt(slot.end_time.split(":")[0]);
      for (let h = start; h < end; h++) existingHours.push(h);
    });
    setBatchStartHours(existingHours);
    setBatchDates([]);
    setShowBatchCalendar(false);
    setBatchDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Disponibilidade
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Selecione um dia e defina seus horários</p>
          </div>
          <Button size="sm" variant="outline" onClick={openBatchDialog} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Aplicar em Lote</span>
            <span className="sm:hidden">Lote</span>
          </Button>
        </div>
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
              disabled={(date) => isBefore(date, today)}
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
              <div className="flex gap-1.5">
                {selectedDaySlots.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                    onClick={() => deleteDayMutation.mutate(format(selectedDate, "yyyy-MM-dd"))}
                    disabled={deleteDayMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={openAddSlotDialog} className="h-7 px-2 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Horário
                </Button>
                {selectedDaySlots.length > 0 && (
                  <Button size="sm" variant="outline" onClick={copyCurrentDayToBatch} className="h-7 px-2 text-xs">
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                )}
              </div>
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

      {/* Add Slot Dialog - Hour Grid */}
      <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Adicionar Horários
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground">
            Toque nos horários para selecionar. Toque em dois horários para selecionar o intervalo.
          </p>

          <HourGrid
            hours={selectedStartHours}
            onToggle={(h) => toggleHour(h, selectedStartHours, setSelectedStartHours, selectionStart, setSelectionStart)}
          />

          {periods.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Períodos selecionados:</p>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {p.start} - {p.end}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => addSlotMutation.mutate(periods)}
              disabled={periods.length === 0 || addSlotMutation.isPending}
              className="w-full"
            >
              {addSlotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar {periods.length > 1 ? `${periods.length} períodos` : "período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Apply Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Aplicar Horários em Lote
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Defina os horários e selecione os dias para aplicar de uma só vez.
          </p>

          {/* Step 1: Select hours */}
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Selecione os horários</p>
            <HourGrid
              hours={batchStartHours}
              onToggle={(h) => toggleHour(h, batchStartHours, setBatchStartHours, batchSelectionStart, setBatchSelectionStart)}
            />
            {batchPeriods.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {batchPeriods.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {p.start} - {p.end}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Select dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">2. Selecione os dias</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowBatchCalendar(!showBatchCalendar)}
              >
                {showBatchCalendar ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {batchDates.length > 0 ? `${batchDates.length} dia(s)` : "Selecionar"}
              </Button>
            </div>

            {showBatchCalendar && (
              <Calendar
                mode="multiple"
                selected={batchDates}
                onSelect={(dates) => setBatchDates(dates || [])}
                locale={ptBR}
                className="pointer-events-auto w-full"
                disabled={(date) => isBefore(date, today)}
              />
            )}

            {!showBatchCalendar && batchDates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {batchDates
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {format(d, "dd/MM", { locale: ptBR })}
                    </Badge>
                  ))}
              </div>
            )}

            {batchPeriods.length > 0 && !showBatchCalendar && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Quick select next 7 days
                    const days: Date[] = [];
                    for (let i = 0; i < 7; i++) {
                      const d = addDays(new Date(), i);
                      if (d.getDay() !== 0) days.push(d); // skip Sundays
                    }
                    setBatchDates(days);
                  }}
                >
                  Próx. 7 dias (seg-sáb)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Quick select weekdays next 14 days
                    const days: Date[] = [];
                    for (let i = 0; i < 14; i++) {
                      const d = addDays(new Date(), i);
                      if (d.getDay() >= 1 && d.getDay() <= 5) days.push(d);
                    }
                    setBatchDates(days);
                  }}
                >
                  Próx. 2 semanas (seg-sex)
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => batchMutation.mutate()}
              disabled={batchPeriods.length === 0 || batchDates.length === 0 || batchMutation.isPending}
              className="w-full"
            >
              {batchMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Aplicar para {batchDates.length} dia(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Reusable hour grid component
function HourGrid({ hours, onToggle }: { hours: number[]; onToggle: (h: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {HOURS.map((h) => {
        const isSelected = hours.includes(h);
        return (
          <button
            key={h}
            type="button"
            onClick={() => onToggle(h)}
            className={cn(
              "rounded-md py-2 text-xs font-medium transition-colors border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {formatHour(h)}
          </button>
        );
      })}
    </div>
  );
}
