import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ChevronRight, Calendar as CalendarIcon, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomService {
  id: string;
  name: string;
  icon: string;
}

interface AvailabilitySlot {
  available_date: string;
  start_time: string;
  end_time: string;
}

interface OccupiedSlot {
  scheduled_at?: string;
  scheduled_date?: string;
}

export function ServiceRequestButtons() {
  const [selectedService, setSelectedService] = useState<CustomService | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const { client, organizationId } = useGestanteAuth();
  const queryClient = useQueryClient();

  const isGestante = client?.status === "gestante";
  const clientOrganizationId = client?.organization_id || organizationId || null;

  const { data: services = [] } = useQuery({
    queryKey: ["client-available-services", client?.id, clientOrganizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_services")
        .select("id, name, icon")
        .eq("organization_id", clientOrganizationId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as CustomService[];
    },
    enabled: !!client?.id && !!clientOrganizationId,
  });

  // Fetch doula availability
  const { data: availability } = useQuery({
    queryKey: ["doula-availability-services", clientOrganizationId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("doula_availability")
        .select("available_date, start_time, end_time")
        .eq("organization_id", clientOrganizationId!)
        .gte("available_date", today)
        .order("available_date", { ascending: true });
      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!clientOrganizationId,
  });

  // Fetch occupied slots (appointments + scheduled services)
  const { data: occupiedSlots } = useQuery({
    queryKey: ["occupied-slots-services", clientOrganizationId],
    queryFn: async () => {
      const today = new Date().toISOString();
      const [aptsRes, srRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("organization_id", clientOrganizationId!)
          .gte("scheduled_at", today)
          .is("completed_at", null),
        supabase
          .from("service_requests")
          .select("scheduled_date")
          .eq("organization_id", clientOrganizationId!)
          .in("status", ["accepted", "date_proposed"])
          .not("scheduled_date", "is", null),
      ]);
      
      const occupied: string[] = [];
      (aptsRes.data || []).forEach((a: any) => {
        if (a.scheduled_at) {
          const d = new Date(a.scheduled_at);
          occupied.push(`${format(d, "yyyy-MM-dd")}_${format(d, "HH:mm")}`);
        }
      });
      (srRes.data || []).forEach((s: any) => {
        if (s.scheduled_date) {
          const d = new Date(s.scheduled_date);
          occupied.push(`${format(d, "yyyy-MM-dd")}_${format(d, "HH:mm")}`);
        }
      });
      return new Set(occupied);
    },
    enabled: !!clientOrganizationId,
  });

  // Filter: gestantes can't see Laserterapia
  const availableServices = services.filter((s) => {
    if (isGestante && s.name.toLowerCase() === "laserterapia") return false;
    return true;
  });

  const availableDates = new Set((availability || []).map((a) => a.available_date));

  const selectedDaySlots = selectedDate
    ? (availability || []).filter((a) => a.available_date === format(selectedDate, "yyyy-MM-dd"))
    : [];

  // Generate time options from availability slots, filtering occupied
  const timeOptions: string[] = [];
  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  selectedDaySlots.forEach((slot) => {
    const start = parseInt(slot.start_time.split(":")[0]);
    const end = parseInt(slot.end_time.split(":")[0]);
    for (let h = start; h < end; h++) {
      const t1 = `${String(h).padStart(2, "0")}:00`;
      const t2 = `${String(h).padStart(2, "0")}:30`;
      if (!occupiedSlots?.has(`${dateStr}_${t1}`)) timeOptions.push(t1);
      if (!occupiedSlots?.has(`${dateStr}_${t2}`)) timeOptions.push(t2);
    }
  });

  const requestMutation = useMutation({
    mutationFn: async (service: CustomService) => {
      if (!client?.id) throw new Error("Cliente não encontrado");
      if (!selectedDate || !selectedTime) throw new Error("Data/horário não selecionados");
      
      const preferredDateTime = new Date(`${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`);
      
      const insertData: Record<string, unknown> = {
        client_id: client.id,
        service_type: service.name,
        status: "pending",
        organization_id: clientOrganizationId,
        preferred_date: preferredDateTime.toISOString(),
      };
      const { error } = await supabase.from("service_requests").insert(insertData as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-services"] });
      queryClient.invalidateQueries({ queryKey: ["occupied-slots-services"] });
      toast.success("Solicitação enviada com sucesso!", {
        description: "Sua Doula receberá uma notificação e enviará o orçamento.",
      });
      setConfirmDialogOpen(false);
      setSelectedService(null);
      setSelectedDate(undefined);
      setSelectedTime("");
    },
    onError: () => {
      toast.error("Erro ao enviar solicitação", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  const handleServiceClick = (service: CustomService) => {
    setSelectedService(service);
    setSelectedDate(undefined);
    setSelectedTime("");
    setConfirmDialogOpen(true);
  };

  const handleConfirmRequest = () => {
    if (selectedService) {
      requestMutation.mutate(selectedService);
    }
  };

  if (availableServices.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
          Solicitar Serviços
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {availableServices.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              onClick={() => handleServiceClick(service)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-lg">
                  {service.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{service.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && (
                <>
                  <span className="text-lg">{selectedService.icon}</span>
                  Solicitar {selectedService.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Escolha uma data e horário disponíveis. Sua Doula confirmará ou sugerirá outra data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date picker filtered by availability */}
            <div>
              <Label className="text-xs mb-2 block flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                Selecione um dia disponível
              </Label>
              {availability && availability.length > 0 ? (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    setSelectedDate(d);
                    setSelectedTime("");
                  }}
                  locale={ptBR}
                  className="pointer-events-auto w-full"
                  disabled={(date) =>
                    !availableDates.has(format(date, "yyyy-MM-dd")) ||
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  modifiers={{
                    available: (date) => availableDates.has(format(date, "yyyy-MM-dd")),
                  }}
                  modifiersClassNames={{
                    available: "svc-avail-highlight",
                  }}
                />
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                  Sua doula ainda não definiu horários disponíveis
                </div>
              )}
              <style>{`
                .svc-avail-highlight {
                  background-color: hsl(var(--primary) / 0.15) !important;
                  font-weight: 600;
                }
              `}</style>
            </div>

            {/* Time picker filtered by occupied slots */}
            {selectedDate && timeOptions.length > 0 && (
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Horário disponível
                </Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o horário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDate && timeOptions.length === 0 && (
              <div className="text-center py-3 text-xs text-muted-foreground border rounded-lg">
                <AlertCircle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                Todos os horários deste dia já estão ocupados
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={requestMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmRequest}
              disabled={requestMutation.isPending || !selectedDate || !selectedTime}
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Confirmar Solicitação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
