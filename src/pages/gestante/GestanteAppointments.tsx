import { useState } from "react";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOccupiedSlots } from "@/hooks/useOccupiedSlots";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Clock, Plus, Loader2, CheckCircle, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import { format, isSameDay, isFuture, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatBrazilDateTime } from "@/lib/utils";
import { sendPushNotification } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  available_date: string;
  start_time: string;
  end_time: string;
}

interface AppointmentRequest {
  id: string;
  requested_date: string;
  requested_time: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface Appointment {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  completed_at: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-100 text-amber-800" },
  approved: { label: "Aprovada", icon: CheckCircle, className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Recusada", icon: XCircle, className: "bg-red-100 text-red-800" },
};

export default function GestanteAppointments() {
  const { client, organizationId } = useGestanteAuth();
  const clientOrganizationId = client?.organization_id || organizationId || null;
  const queryClient = useQueryClient();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch upcoming appointments
  const { data: appointments, isLoading: loadingApts } = useQuery({
    queryKey: ["gestante-appointments", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, scheduled_at, notes, completed_at")
        .eq("client_id", client!.id)
        .not("title", "like", "Serviço:%")
        .is("completed_at", null)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!client?.id,
  });

  // Fetch doula availability
  const { data: availability } = useQuery({
    queryKey: ["doula-availability-client", clientOrganizationId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("doula_availability")
        .select("*")
        .eq("organization_id", clientOrganizationId!)
        .gte("available_date", today)
        .order("available_date", { ascending: true });
      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!clientOrganizationId,
  });

  // Unified occupied slots (appointments + services + requests)
  const { data: occupiedSlots } = useOccupiedSlots(clientOrganizationId);

  // Fetch my appointment requests
  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["my-appointment-requests", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AppointmentRequest[];
    },
    enabled: !!client?.id,
  });


  // Fetch completed appointments history
  const { data: completedAppointments } = useQuery({
    queryKey: ["gestante-completed-appointments", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, scheduled_at, notes, completed_at, completion_notes")
        .eq("client_id", client!.id)
        .not("title", "like", "Serviço:%")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as (Appointment & { completion_notes: string | null })[];
    },
    enabled: !!client?.id,
  });

  const availableDates = new Set((availability || []).map((a) => a.available_date));

  const selectedDaySlots = selectedDate
    ? (availability || []).filter((a) => a.available_date === format(selectedDate, "yyyy-MM-dd"))
    : [];

  // Generate time options from slots, filtering out occupied
  const timeOptions: string[] = [];
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  selectedDaySlots.forEach((slot) => {
    const start = parseInt(slot.start_time.split(":")[0]);
    const end = parseInt(slot.end_time.split(":")[0]);
    for (let h = start; h < end; h++) {
      const t1 = `${String(h).padStart(2, "0")}:00`;
      const t2 = `${String(h).padStart(2, "0")}:30`;
      if (!occupiedSlots?.has(`${selectedDateStr}_${t1}`)) timeOptions.push(t1);
      if (!occupiedSlots?.has(`${selectedDateStr}_${t2}`)) timeOptions.push(t2);
    }
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      // Fetch client's registered address
      const { data: clientData } = await supabase
        .from("clients")
        .select("street, number, neighborhood, city, state")
        .eq("id", client!.id)
        .single();

      const addressParts = [
        clientData?.street,
        clientData?.number,
        clientData?.neighborhood,
        clientData?.city,
        clientData?.state,
      ].filter(Boolean);
      const clientAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

      const { error } = await supabase.from("appointment_requests").insert({
        client_id: client!.id,
        organization_id: clientOrganizationId,
        requested_date: format(selectedDate!, "yyyy-MM-dd"),
        requested_time: selectedTime,
        reason: reason || null,
        address: clientAddress,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-appointment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["occupied-slots"] });
      setRequestDialogOpen(false);
      setSelectedDate(undefined);
      setSelectedTime("");
      setReason("");
      toast.success("Solicitação enviada!", {
        description: "Sua doula irá confirmar a consulta.",
      });

      // Notify doula via push notification
      sendPushNotification({
        send_to_admins: true,
        title: "📅 Nova Solicitação de Consulta",
        message: `${client?.full_name || "Uma cliente"} solicitou uma consulta.`,
        type: "appointment_reminder",
      });
    },
    onError: () => toast.error("Erro ao solicitar consulta"),
  });

  const isLoading = loadingApts || loadingRequests;

  return (
    <GestanteLayout>
      <div className="p-3 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Consultas</h1>
              <p className="page-description">Acompanhe e solicite novas consultas</p>
            </div>
            <Button size="sm" onClick={() => setRequestDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Solicitar
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Appointments Card — matches services card style */}
          {(hasUpcoming || hasPendingRequests || hasCompleted) && (
            <Card className="overflow-hidden bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  <h2 className="font-display font-semibold text-base">Consultas Agendadas</h2>
                </div>

                {/* Active upcoming appointments */}
                {hasUpcoming && (
                  <div className="space-y-2">
                    {appointments!.map((apt) => {
                      const date = new Date(apt.scheduled_at);
                      return (
                        <div key={apt.id} className="bg-background/60 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{apt.title}</p>
                            {isToday(date) ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800">Hoje</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-blue-700">Agendada</Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(date, "EEEE, HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-primary font-medium">
                              📅 {format(date, "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground truncate">{apt.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pending Requests */}
                {hasPendingRequests && (
                  <div className={cn("space-y-2", hasUpcoming && "mt-3")}>
                    <p className="text-xs font-medium text-muted-foreground px-1">Solicitações Pendentes</p>
                    {pendingRequests!.map((req) => {
                      const config = statusConfig[req.status] || statusConfig.pending;
                      const StatusIcon = config.icon;
                      return (
                        <div key={req.id} className="bg-background/60 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">
                              {format(new Date(req.requested_date + "T00:00:00"), "dd/MM/yyyy")} às {req.requested_time.slice(0, 5)}
                            </p>
                            <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          {req.reason && (
                            <p className="text-xs text-muted-foreground">{req.reason}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Solicitado em {formatBrazilDateTime(req.created_at, "dd/MM/yyyy")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Completed Appointments History — collapsible compact list */}
                {hasCompleted && (
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className={(hasUpcoming || hasPendingRequests) ? "mt-3" : ""}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Histórico ({completedAppointments!.length})
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-0 divide-y divide-border/50">
                        {completedAppointments!.map((apt) => {
                          const date = new Date(apt.scheduled_at);
                          return (
                            <div key={apt.id} className="flex items-center justify-between py-2 px-1 gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{apt.title}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {apt.completion_notes && (
                                  <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">
                                    {apt.completion_notes}
                                  </p>
                                )}
                              </div>
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && !hasUpcoming && !hasPendingRequests && !hasCompleted && (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta agendada</p>
              <Button size="sm" className="mt-3" onClick={() => setRequestDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Solicitar Consulta
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Solicitar Consulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">Selecione um dia disponível</Label>
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
                    available: "avail-highlight",
                  }}
                />
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground rounded-lg">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                  Sua doula ainda não definiu horários disponíveis
                </div>
              )}
              <style>{`
                .avail-highlight {
                  background-color: hsl(var(--primary) / 0.15) !important;
                  font-weight: 600;
                }
              `}</style>
            </div>

            {selectedDate && timeOptions.length > 0 && (
              <div>
                <Label className="text-xs">Horário</Label>
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

            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                placeholder="Descreva o motivo da consulta..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={!selectedDate || !selectedTime || requestMutation.isPending}
              className="w-full"
            >
              {requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GestanteLayout>
  );
}
