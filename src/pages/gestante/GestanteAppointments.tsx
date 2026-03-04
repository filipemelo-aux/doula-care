import { useState } from "react";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Clock, Plus, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
  approved: { label: "Aprovada", icon: CheckCircle, className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "Recusada", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300" },
};

export default function GestanteAppointments() {
  const { client, organizationId } = useGestanteAuth();
  const clientOrganizationId = client?.organization_id || organizationId || null;
  const queryClient = useQueryClient();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");

  // Fetch upcoming appointments
  const { data: appointments, isLoading: loadingApts } = useQuery({
    queryKey: ["gestante-appointments", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, scheduled_at, notes, completed_at")
        .eq("client_id", client!.id)
        .not("title", "like", "Serviço:%")
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

  // Fetch occupied slots (appointments + scheduled services)
  const { data: occupiedSlots } = useQuery({
    queryKey: ["occupied-slots-appointments", clientOrganizationId],
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
      const { error } = await supabase.from("appointment_requests").insert({
        client_id: client!.id,
        organization_id: clientOrganizationId,
        requested_date: format(selectedDate!, "yyyy-MM-dd"),
        requested_time: selectedTime,
        reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-appointment-requests"] });
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
          {/* Upcoming Appointments */}
          {appointments && appointments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
                Próximas Consultas
              </h3>
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const date = new Date(apt.scheduled_at);
                  return (
                    <Card key={apt.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[44px]">
                            <p className="text-[10px] text-muted-foreground uppercase">
                              {format(date, "MMM", { locale: ptBR })}
                            </p>
                            <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{apt.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(date, "EEEE, HH:mm", { locale: ptBR })}
                              {isToday(date) && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">Hoje</Badge>
                              )}
                            </p>
                            {apt.notes && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{apt.notes}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {requests && requests.filter(r => r.status === "pending").length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
                Solicitações Pendentes
              </h3>
              <div className="space-y-2">
                {requests.filter(r => r.status === "pending").map((req) => {
                  const config = statusConfig[req.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <Card key={req.id}>
                      <CardContent className="p-3 space-y-1">
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Requests */}
          {requests && requests.filter(r => r.status !== "pending").length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
                Histórico de Solicitações
              </h3>
              <div className="space-y-2">
                {requests.filter(r => r.status !== "pending").map((req) => {
                  const config = statusConfig[req.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <Card key={req.id} className="opacity-70">
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {format(new Date(req.requested_date + "T00:00:00"), "dd/MM/yyyy")} às {req.requested_time.slice(0, 5)}
                          </p>
                          <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                        {req.admin_notes && (
                          <p className="text-xs text-primary">Nota: {req.admin_notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!appointments || appointments.length === 0) && (!requests || requests.length === 0) && (
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
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
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
