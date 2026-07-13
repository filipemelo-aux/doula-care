import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { sendPushNotification } from "@/lib/pushNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Star,
  Briefcase,
  Edit2,
  Image as ImageIcon,
  Search,
  Filter,
  CheckCircle,
  Send,
  Eye,
  Info,
  List,
  CalendarDays,
  CalendarCheck,
  MoreVertical,
  MapPin,
  Navigation,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppointmentDetailDialog } from "@/components/clients/AppointmentDetailDialog";
import { AppointmentCompleteDialog } from "@/components/clients/AppointmentCompleteDialog";
import { format, isToday, isPast, isSameDay, addHours, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { SendBudgetDialog } from "@/components/dashboard/SendBudgetDialog";
import { NewServiceDialog } from "@/components/agenda/NewServiceDialog";
import { AvailabilityManager } from "@/components/agenda/AvailabilityManager";
import { AppointmentRequestsSection } from "@/components/agenda/AppointmentRequestsSection";
import { CalendarLabelsManager } from "@/components/agenda/CalendarLabelsManager";
import { DayLabelsDialog } from "@/components/agenda/DayLabelsDialog";
import { useCalendarLabels } from "@/hooks/useCalendarLabels";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchAddressByCep, formatAddressWithNumber } from "@/lib/address";
import { maskCEP } from "@/lib/masks";
import { ensureAvailabilityForAppointment } from "@/lib/ensureAvailability";
import { sortAppointmentsWithFutureFirst } from "@/lib/appointments";

// ─── Types ───────────────────────────────────────────────
interface AppointmentWithClient {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  client_id: string;
  address: string | null;
  clients: { full_name: string };
}

interface ServiceRequestFull {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  budget_sent_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  rating: number | null;
  rating_comment: string | null;
  rating_photos: string[] | null;
  created_at: string;
  client_id: string;
  scheduled_date: string | null;
  preferred_date: string | null;
  clients: { full_name: string };
}

interface ClientOption {
  id: string;
  full_name: string;
  user_id?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

type AgendaFilter = "calendar" | "all";

// ─── Status helpers ──────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  budget_sent: { label: "Orçamento Enviado", color: "bg-purple-100 text-purple-800 border-purple-300" },
  date_proposed: { label: "Data Proposta", color: "bg-orange-100 text-orange-800 border-orange-300" },
  accepted: { label: "Aceito", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "Recusado", color: "bg-red-100 text-red-800" },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-800" },
};

const getServiceStatus = (svc: ServiceRequestFull) => {
  if (svc.completed_at) return "completed";
  return svc.status;
};

export default function Agenda() {
  const { user, organizationId } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Appointment form
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithClient | null>(null);
  const [aptTitle, setAptTitle] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("10:00");
  const [aptNotes, setAptNotes] = useState("");
  const [aptClientId, setAptClientId] = useState("");
  const [aptStatus, setAptStatus] = useState<"pendente" | "concluida">("pendente");
  const [aptAddress, setAptAddress] = useState("");
  const [aptIsLocal, setAptIsLocal] = useState(false);
  const [aptCep, setAptCep] = useState("");
  const [aptCepLoading, setAptCepLoading] = useState(false);
  const [aptCepData, setAptCepData] = useState<{street:string; neighborhood:string; city:string; state:string} | null>(null);
  const [aptNumber, setAptNumber] = useState("");



  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "appointment" | "service"; id: string } | null>(null);

  // Budget dialog
  const [budgetRequest, setBudgetRequest] = useState<{ id: string; client_id: string; service_type: string; client_name: string; preferred_date?: string | null } | null>(null);

  // Photo viewer
  const [viewingPhotos, setViewingPhotos] = useState<{ photos: string[]; comment: string | null; rating: number } | null>(null);

  // Calendar labels
  const [labelsManagerOpen, setLabelsManagerOpen] = useState(false);
  const [dayLabelsFor, setDayLabelsFor] = useState<Date | null>(null);
  const { dayMap: labelsDayMap } = useCalendarLabels(organizationId);

  // Appointment detail preview (opened from external links, e.g. Dashboard)
  const [selectedDetailApt, setSelectedDetailApt] = useState<AppointmentWithClient | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // ─── Queries ─────────────────────────────────────────────
  const { data: appointments, isLoading: loadingApts } = useQuery({
    queryKey: ["agenda-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as AppointmentWithClient[]).map(apt => ({
        ...apt,
        clients: apt.clients || { full_name: "" },
      }));
    },
  });

  const { data: services, isLoading: loadingSvc } = useQuery({
    queryKey: ["agenda-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, clients(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ServiceRequestFull[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["agenda-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, user_id, street, number, neighborhood, city, state")
        .order("full_name");
      if (error) throw error;
      return data as ClientOption[];
    },
    enabled: appointmentDialog,
  });

  // ─── Mutations ───────────────────────────────────────────
  // Personal appointment dialog
  const [personalAptDialog, setPersonalAptDialog] = useState(false);
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalDate, setPersonalDate] = useState("");
  const [personalTime, setPersonalTime] = useState("10:00");
  const [personalNotes, setPersonalNotes] = useState("");
  const [personalAddress, setPersonalAddress] = useState("");
  const [personalCep, setPersonalCep] = useState("");
  const [personalCepLoading, setPersonalCepLoading] = useState(false);
  const [personalCepData, setPersonalCepData] = useState<{street:string; neighborhood:string; city:string; state:string} | null>(null);
  const [personalNumber, setPersonalNumber] = useState("");

  // Auto-open dialog from navigation state (e.g. from Dashboard)
  useEffect(() => {
    const state = location.state as { openDialog?: string; viewAppointmentId?: string } | null;
    if (state?.viewAppointmentId && appointments) {
      const apt = appointments.find((a) => a.id === state.viewAppointmentId);
      if (apt) {
        setSelectedDetailApt(apt);
        setDetailDialogOpen(true);
        window.history.replaceState({}, document.title);
        return;
      }
    }
    if (state?.openDialog) {
      if (state.openDialog === "consulta") setAppointmentDialog(true);
      else if (state.openDialog === "compromisso") setPersonalAptDialog(true);
      else if (state.openDialog === "servico") setServiceDialog(true);
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, appointments]);

  const closePersonalDialog = () => {
    setPersonalAptDialog(false);
    setPersonalTitle("");
    setPersonalDate("");
    setPersonalTime("10:00");
    setPersonalNotes("");
    setPersonalAddress("");
    setPersonalCep("");
    setPersonalCepLoading(false);
    setPersonalCepData(null);
    setPersonalNumber("");
  };

  const savePersonalMutation = useMutation({
    mutationFn: async () => {
      const scheduledUtc = fromZonedTime(`${personalDate}T${personalTime}`, "America/Sao_Paulo").toISOString();
      const { error } = await supabase.from("appointments").insert({
        title: personalTitle,
        scheduled_at: scheduledUtc,
        notes: personalNotes || null,
        address: personalAddress.trim() || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      } as any);
      if (error) throw error;
      await ensureAvailabilityForAppointment(organizationId, scheduledUtc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });
      closePersonalDialog();
      toast.success("Compromisso pessoal agendado!");

      // Create org_notification for the personal appointment
      if (organizationId) {
        supabase.from("org_notifications").insert({
          organization_id: organizationId,
          title: "📋 Compromisso Pessoal",
          message: `Novo compromisso agendado: ${personalTitle}`,
          type: "agenda",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["org-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
        });
      }

      // Push notification to self (admin)
      if (user?.id) {
        sendPushNotification({
          user_ids: [user.id],
          title: "📋 Compromisso Pessoal Agendado",
          message: personalTitle,
          url: "/agenda",
          tag: "personal-appointment",
          type: "personal_appointment",
        });
      }
    },
    onError: () => toast.error("Erro ao salvar compromisso"),
  });

  const saveAppointmentMutation = useMutation({
    mutationFn: async () => {
      const scheduledUtc = fromZonedTime(`${aptDate}T${aptTime}`, "America/Sao_Paulo").toISOString();
      const finalAddress = aptIsLocal ? null : aptAddress.trim() || null;

      if (editingAppointment) {
        const updateData: Record<string, unknown> = {
          title: aptTitle,
          scheduled_at: scheduledUtc,
          notes: aptNotes || null,
          address: finalAddress,
        };
        if (aptStatus === "concluida" && !editingAppointment.completed_at) {
          updateData.completed_at = new Date().toISOString();
        } else if (aptStatus === "pendente" && editingAppointment.completed_at) {
          updateData.completed_at = null;
          updateData.completion_notes = null;
        }
        const { error } = await supabase
          .from("appointments")
          .update(updateData)
          .eq("id", editingAppointment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert({
          client_id: aptClientId || null,
          title: aptTitle,
          scheduled_at: scheduledUtc,
          notes: aptNotes || null,
          address: finalAddress,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        } as any);
        if (error) throw error;
        await ensureAvailabilityForAppointment(organizationId, scheduledUtc);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doula-availability"] });

      // Send push to client when new appointment is created (not editing)
      if (!editingAppointment && aptClientId) {
        const selectedClient = clients?.find(c => c.id === aptClientId);
        if (selectedClient?.user_id) {
          sendPushNotification({
            user_ids: [selectedClient.user_id],
            title: "📅 Nova Consulta Agendada",
            message: `Sua doula agendou: ${aptTitle}`,
            url: "/gestante/consultas",
            tag: "new-appointment",
            type: "new_appointment",
          });
        }
      }

      closeAppointmentDialog();
      toast.success(editingAppointment ? "Consulta atualizada!" : "Consulta agendada!");
    },
    onError: () => toast.error("Erro ao salvar consulta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: { type: string; id: string }) => {
      if (target.type === "appointment") {
        // Get the appointment before deleting to check if it's a service
        const { data: apt } = await supabase
          .from("appointments")
          .select("title, client_id")
          .eq("id", target.id)
          .single();

        const { error } = await supabase.from("appointments").delete().eq("id", target.id);
        if (error) throw error;

        // If it's a service appointment, also delete matching transaction
        if (apt && apt.title?.startsWith("Serviço:") && apt.client_id) {
          await supabase
            .from("transactions")
            .delete()
            .eq("client_id", apt.client_id)
            .eq("description", apt.title);
        }
      } else {
        const { error } = await supabase.from("service_requests").delete().eq("id", target.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, target) => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-services"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Removido com sucesso!");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });



  const closeAppointmentDialog = () => {
    setAppointmentDialog(false);
    setEditingAppointment(null);
    setAptTitle("");
    setAptDate("");
    setAptTime("10:00");
    setAptNotes("");
    setAptAddress("");
    setAptClientId("");
    setAptStatus("pendente");
    setAptIsLocal(false);
    setAptCep("");
    setAptCepLoading(false);
    setAptCepData(null);
    setAptNumber("");
  };

  const openEditAppointment = (apt: AppointmentWithClient) => {
    setEditingAppointment(apt);
    setAptTitle(apt.title);
    const zonedDate = toZonedTime(new Date(apt.scheduled_at), "America/Sao_Paulo");
    setAptDate(format(zonedDate, "yyyy-MM-dd"));
    setAptTime(format(zonedDate, "HH:mm"));
    setAptNotes(apt.notes || "");
    setAptAddress(apt.address || "");
    setAptClientId(apt.client_id);
    setAptStatus(apt.completed_at ? "concluida" : "pendente");
    setAptIsLocal(!apt.address);
    setAppointmentDialog(true);
  };

  const handleAptClientChange = (id: string) => {
    setAptClientId(id);
    const client = clients?.find(c => c.id === id);
    if (client) {
      const parts = [client.street, client.number, client.neighborhood, client.city, client.state].filter(Boolean);
      const addr = parts.join(", ");
      if (addr) {
        setAptAddress(addr);
        setAptCep("");
        setAptCepData(null);
        setAptNumber("");
      } else {
        setAptAddress("");
      }
    } else {
      setAptAddress("");
    }
  };

  const handleAptCepLookup = async (rawCep: string) => {
    const cep = maskCEP(rawCep);
    setAptCep(cep);
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      setAptCepLoading(true);
      const result = await fetchAddressByCep(clean);
      setAptCepLoading(false);
      if (result) {
        setAptCepData(result);
        setAptAddress(formatAddressWithNumber(result, ""));
        setAptNumber("");
      } else {
        toast.error("CEP não encontrado");
      }
    }
  };

  const handleAptNumberChange = (num: string) => {
    setAptNumber(num);
    if (aptCepData) {
      setAptAddress(formatAddressWithNumber(aptCepData, num));
    }
  };

  const handlePersonalCepLookup = async (rawCep: string) => {
    const cep = maskCEP(rawCep);
    setPersonalCep(cep);
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      setPersonalCepLoading(true);
      const result = await fetchAddressByCep(clean);
      setPersonalCepLoading(false);
      if (result) {
        setPersonalCepData(result);
        setPersonalAddress(formatAddressWithNumber(result, ""));
        setPersonalNumber("");
      } else {
        toast.error("CEP não encontrado");
      }
    }
  };

  const handlePersonalNumberChange = (num: string) => {
    setPersonalNumber(num);
    if (personalCepData) {
      setPersonalAddress(formatAddressWithNumber(personalCepData, num));
    }
  };

  const displayName = (name: string) => {
    const parts = name.split(" ");
    if (parts.length <= 2) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  // ─── Filtering ───────────────────────────────────────────
  const allApts = appointments || [];

  const now = new Date();

  // Filter appointments based on the agenda filter mode
  const filteredAppointments = useMemo(() => {
    let apts = allApts;

    // Apply calendar date filter
    if (agendaFilter === "calendar") {
      apts = apts.filter((apt) => isSameDay(toZonedTime(new Date(apt.scheduled_at), "America/Sao_Paulo"), selectedDate));
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      apts = apts.filter((apt) =>
        apt.title.toLowerCase().includes(term) || (apt.clients?.full_name || "").toLowerCase().includes(term)
      );
    }

    return apts;
  }, [allApts, agendaFilter, selectedDate, searchTerm]);

  const filteredServices = useMemo(() => {
    let svcs = services || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      svcs = svcs.filter((svc) =>
        svc.service_type.toLowerCase().includes(term) || svc.clients?.full_name.toLowerCase().includes(term)
      );
    }
    return svcs;
  }, [services, searchTerm]);

  const activeServices = useMemo(
    () => filteredServices.filter((s) => s.status === "pending" || s.status === "budget_sent" || s.status === "date_proposed"),
    [filteredServices]
  );

  const activeServicesForView = useMemo(() => {
    if (agendaFilter !== "calendar") return activeServices;
    return activeServices.filter((svc) => {
      const dateStr = svc.scheduled_date || svc.preferred_date;
      if (!dateStr) return false;
      return isSameDay(toZonedTime(new Date(dateStr), "America/Sao_Paulo"), selectedDate);
    });
  }, [activeServices, agendaFilter, selectedDate]);

  const unifiedItems = useMemo(() => {
    const items: (
      | { type: "appointment"; data: AppointmentWithClient; scheduled_at: string; completed_at: string | null }
      | { type: "service"; data: ServiceRequestFull; scheduled_at: string; completed_at: null }
    )[] = [
      ...filteredAppointments.map((apt) => ({
        type: "appointment" as const,
        data: apt,
        scheduled_at: apt.scheduled_at,
        completed_at: apt.completed_at,
      })),
      ...activeServicesForView.map((svc) => ({
        type: "service" as const,
        data: svc,
        scheduled_at: svc.scheduled_date || svc.preferred_date || svc.created_at,
        completed_at: null,
      })),
    ];
    return sortAppointmentsWithFutureFirst(items);
  }, [filteredAppointments, activeServicesForView]);




  const isLoading = loadingApts || loadingSvc;

  // ─── Stats ───────────────────────────────────────────────
  const pendingServices = (services || []).filter(s => s.status === "pending").length;
  const budgetSentServices = (services || []).filter(s => s.status === "budget_sent").length;
  const inProgressApts = allApts.filter(a => {
    if (a.completed_at) return false;
    const scheduledTime = new Date(a.scheduled_at);
    const scheduledEnd = addHours(scheduledTime, 1);
    return isWithinInterval(now, { start: scheduledTime, end: scheduledEnd });
  }).length;

  // Dates with appointments for calendar indicator
  const datesWithAppointments = useMemo(() => {
    const set = new Set<string>();
    allApts.forEach((apt) => {
      const zoned = toZonedTime(new Date(apt.scheduled_at), "America/Sao_Paulo");
      set.add(format(zoned, "yyyy-MM-dd"));
    });
    return set;
  }, [allApts]);

  return (
    <div className="space-y-6 lg:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Agenda</h1>
          <p className="page-description">Consultas e serviços em um só lugar</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setLabelsManagerOpen(true)}
        >
          <Tag className="h-4 w-4" />
          <span>Etiquetas</span>
        </Button>


      </div>



      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por cliente ou compromisso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "list" | "calendar")}
          className="w-full sm:w-auto justify-stretch"
        >
          <ToggleGroupItem value="list" aria-label="Compromissos" className="h-10 gap-1.5 px-3 flex-1 sm:flex-initial">
            <List className="h-4 w-4" />
            <span className="text-sm">Compromissos</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label="Disponibilidade" className="h-10 gap-1.5 px-3 flex-1 sm:flex-initial">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm">Disponibilidade</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Calendar View - availability only */}
      {viewMode === "calendar" && (
        <AvailabilityManager />
      )}

      {/* Filter Toggle: Calendar Date vs All */}
      {viewMode === "list" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={agendaFilter}
              onValueChange={(v) => v && setAgendaFilter(v as AgendaFilter)}
              className="flex-1"
            >
              <ToggleGroupItem value="calendar" className="flex-1 gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Data no calendário
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="flex-1 gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <List className="h-3.5 w-3.5" />
                Todos os compromissos
              </ToggleGroupItem>
            </ToggleGroup>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" className="h-10 w-10 rounded-full shrink-0">
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setAppointmentDialog(true)} className="gap-2.5 py-2.5">
                  <Calendar className="h-4 w-4" /> Nova consulta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPersonalAptDialog(true)} className="gap-2.5 py-2.5">
                  <CalendarCheck className="h-4 w-4" /> Novo compromisso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setServiceDialog(true)} className="gap-2.5 py-2.5">
                  <Briefcase className="h-4 w-4" /> Novo serviço
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>


          {/* Inline calendar when filter is "calendar" */}
          {agendaFilter === "calendar" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-3">
                  <CalendarPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={ptBR}
                    className="pointer-events-auto w-full mx-auto"
                    modifiers={{
                      hasAppointment: (date) =>
                        datesWithAppointments.has(format(date, "yyyy-MM-dd")),
                      hasLabel: (date) => labelsDayMap.has(format(date, "yyyy-MM-dd")),
                    }}
                    modifiersClassNames={{
                      hasAppointment: "has-appointment",
                      hasLabel: "has-label",
                    }}
                    components={{
                      DayContent: (props) => {
                        const key = format(props.date, "yyyy-MM-dd");
                        const dayLabels = labelsDayMap.get(key) || [];
                        return (
                          <div className="relative flex flex-col items-center justify-center w-full h-full">
                            <span>{props.date.getDate()}</span>
                            {dayLabels.length > 0 && (
                              <div
                                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex overflow-hidden rounded-full"
                                style={{ width: "70%", height: "3px" }}
                              >
                                {dayLabels.slice(0, 4).map((d) => (
                                  <span
                                    key={d.id}
                                    className="flex-1"
                                    style={{ backgroundColor: d.label?.color || "#999" }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      },
                    }}
                  />
                  <style>{`
                    .has-appointment::before {
                      content: '';
                      position: absolute;
                      top: 4px;
                      right: 4px;
                      width: 5px;
                      height: 5px;
                      border-radius: 50%;
                      background-color: hsl(var(--primary));
                      z-index: 1;
                    }
                    .has-appointment {
                      position: relative;
                    }
                  `}</style>

                  {/* Manage labels on selected day */}
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {(labelsDayMap.get(format(selectedDate, "yyyy-MM-dd")) || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sem etiquetas neste dia</span>
                        ) : (
                          (labelsDayMap.get(format(selectedDate, "yyyy-MM-dd")) || []).map((d) => (
                            <span
                              key={d.id}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                              style={{ backgroundColor: d.label?.color || "#999" }}
                              title={d.note || undefined}
                            >
                              {d.label?.name || "?"}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs flex-shrink-0"
                      onClick={() => setDayLabelsFor(selectedDate)}
                    >
                      Etiquetar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Side panel: selected date appointments + requests (desktop/tablet) */}
              <div className="hidden md:block space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    {format(selectedDate, "dd 'de' MMMM, EEEE", { locale: ptBR })}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {unifiedItems.length}
                    </Badge>
                  </h3>
                  {unifiedItems.length > 0 ? (
                    <ScrollArea className="max-h-[280px]">
                      <div className="space-y-2">
                        {unifiedItems.map((item) =>
                          item.type === "appointment" ? (
                            <AppointmentRow
                              key={item.data.id}
                              apt={item.data}
                              onEdit={openEditAppointment}
                              onDelete={(id) => setDeleteTarget({ type: "appointment", id })}
                              displayName={displayName}
                              past={!!item.data.completed_at}
                              onCompleted={() => queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] })}
                            />
                          ) : (
                            <ServiceRow
                              key={item.data.id}
                              svc={item.data}
                              displayName={displayName}
                              onSendBudget={(s) =>
                                setBudgetRequest({
                                  id: s.id,
                                  client_id: s.client_id,
                                  service_type: s.service_type,
                                  client_name: s.clients?.full_name || "",
                                  preferred_date: s.preferred_date,
                                })
                              }
                              onDelete={(id) => setDeleteTarget({ type: "service", id })}
                              onViewPhotos={setViewingPhotos}
                            />
                          )
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-6">
                      <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum compromisso neste dia</p>
                    </div>
                  )}

                </div>
                <AppointmentRequestsSection />
              </div>
            </div>
          )}

          {/* Appointment Requests - mobile only when calendar mode */}
          {agendaFilter === "calendar" ? (
            <div className="md:hidden">
              <AppointmentRequestsSection />
            </div>
          ) : (
            <AppointmentRequestsSection />
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={`space-y-6 ${agendaFilter === "calendar" ? "md:hidden" : ""}`}>
              {/* Date header when calendar filter */}
              {agendaFilter === "calendar" && (
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM, EEEE", { locale: ptBR })}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {unifiedItems.length}
                  </Badge>
                </h2>
              )}


              {unifiedItems.length > 0 ? (
                <section>
                  <div className="space-y-2">
                    {unifiedItems.map((item) =>
                      item.type === "appointment" ? (
                        <AppointmentRow
                          key={item.data.id}
                          apt={item.data}
                          onEdit={openEditAppointment}
                          onDelete={(id) => setDeleteTarget({ type: "appointment", id })}
                          displayName={displayName}
                          onCompleted={() => queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] })}
                        />
                      ) : (
                        <ServiceRow
                          key={item.data.id}
                          svc={item.data}
                          displayName={displayName}
                          onSendBudget={(s) =>
                            setBudgetRequest({
                              id: s.id,
                              client_id: s.client_id,
                              service_type: s.service_type,
                              client_name: s.clients?.full_name || "",
                              preferred_date: s.preferred_date,
                            })
                          }
                          onDelete={(id) => setDeleteTarget({ type: "service", id })}
                          onViewPhotos={setViewingPhotos}
                        />
                      )
                    )}
                  </div>
                </section>
              ) : null}


              {/* Empty state */}
              {unifiedItems.length === 0 && (
                <EmptyState icon={Calendar} message={agendaFilter === "calendar" ? "Nenhum compromisso neste dia" : "Nenhum compromisso encontrado"} />
              )}

            </div>
          )}
        </div>
      )}
      {/* ─── Dialogs ─── */}

      {/* Appointment Create/Edit */}
      <Dialog open={appointmentDialog} onOpenChange={(o) => !o && closeAppointmentDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingAppointment ? "Editar Consulta" : "Nova Consulta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingAppointment && (
              <div>
                <Label className="text-xs">Cliente (opcional)</Label>
                <Select value={aptClientId} onValueChange={handleAptClientChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione ou deixe em branco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Título *</Label>
              <Input placeholder="Ex: Consulta pré-natal" value={aptTitle} onChange={(e) => setAptTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Horário *</Label>
                <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Local option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="apt-is-local"
                checked={aptIsLocal}
                onCheckedChange={(checked) => setAptIsLocal(checked === true)}
              />
              <Label htmlFor="apt-is-local" className="text-xs cursor-pointer">
                Consulta no local (sem necessidade de endereço)
              </Label>
            </div>

            {/* Address section */}
            {!aptIsLocal && (
              <div className="space-y-3">
                {!editingAppointment && (
                  <div className="space-y-2">
                    <Label className="text-xs">CEP (para buscar endereço)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="00000-000"
                        value={aptCep}
                        onChange={(e) => handleAptCepLookup(e.target.value)}
                        className="w-36"
                        maxLength={9}
                      />
                      {aptCepLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                )}
                {aptCepData && (
                  <div>
                    <Label className="text-xs">Número *</Label>
                    <Input
                      placeholder="Nº do endereço"
                      value={aptNumber}
                      onChange={(e) => handleAptNumberChange(e.target.value)}
                      className="mt-1 w-32"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Endereço da consulta *
                  </Label>
                  <Input
                    placeholder="Digite o endereço ou use o CEP acima"
                    value={aptAddress}
                    onChange={(e) => setAptAddress(e.target.value)}
                    className="mt-1"
                  />
                  {!aptAddress.trim() && aptDate && (
                    <p className="text-xs text-destructive mt-1">Informe o endereço da consulta</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea placeholder="Observações..." value={aptNotes} onChange={(e) => setAptNotes(e.target.value)} rows={2} className="mt-1" />
            </div>
            {editingAppointment && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={aptStatus} onValueChange={(v) => setAptStatus(v as "pendente" | "concluida")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!aptTitle || !aptDate || !aptTime || (!aptIsLocal && !aptAddress.trim()) || saveAppointmentMutation.isPending}
              onClick={() => saveAppointmentMutation.mutate()}
            >
              {saveAppointmentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingAppointment ? "Salvar Alterações" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "appointment" ? "Esta consulta será removida permanentemente." : "Este serviço será removido permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Excluindo...
                </>
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Personal Appointment Dialog */}
      <Dialog open={personalAptDialog} onOpenChange={(o) => !o && closePersonalDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Compromisso Pessoal
            </DialogTitle>
            <DialogDescription>
              Agende compromissos internos que não envolvem clientes (lives, reuniões, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input placeholder="Ex: Gravação de live, Reunião..." value={personalTitle} onChange={(e) => setPersonalTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={personalDate} onChange={(e) => setPersonalDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Horário *</Label>
                <Input type="time" value={personalTime} onChange={(e) => setPersonalTime(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Address via CEP */}
            <div className="space-y-2">
              <Label className="text-xs">CEP (opcional)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="00000-000"
                  value={personalCep}
                  onChange={(e) => handlePersonalCepLookup(e.target.value)}
                  className="w-36"
                  maxLength={9}
                />
                {personalCepLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            {personalCepData && (
              <div>
                <Label className="text-xs">Número</Label>
                <Input
                  placeholder="Nº do endereço"
                  value={personalNumber}
                  onChange={(e) => handlePersonalNumberChange(e.target.value)}
                  className="mt-1 w-32"
                />
              </div>
            )}
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Local (opcional)
              </Label>
              <Input
                placeholder="Adicionar local (opcional)"
                value={personalAddress}
                onChange={(e) => setPersonalAddress(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea placeholder="Detalhes do compromisso..." value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!personalTitle || !personalDate || !personalTime || savePersonalMutation.isPending}
              onClick={() => savePersonalMutation.mutate()}
            >
              {savePersonalMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Service Dialog */}
      <NewServiceDialog
        open={serviceDialog}
        onOpenChange={setServiceDialog}
      />

      {/* Budget Dialog */}
      <SendBudgetDialog
        open={!!budgetRequest}
        onOpenChange={(o) => !o && setBudgetRequest(null)}
        serviceRequest={budgetRequest}
      />

      {/* Photo Viewer */}
      <Dialog open={!!viewingPhotos} onOpenChange={(o) => !o && setViewingPhotos(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Avaliação do Serviço</DialogTitle>
          </DialogHeader>
          {viewingPhotos && (
            <div className="space-y-4">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-5 w-5 ${s <= viewingPhotos.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              {viewingPhotos.comment && (
                <p className="text-sm text-muted-foreground italic">"{viewingPhotos.comment}"</p>
              )}
              {viewingPhotos.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {viewingPhotos.photos.map((url, idx) => (
                    <img key={idx} src={url} alt={`Foto ${idx + 1}`} className="w-full rounded-md object-cover aspect-square" />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calendar labels manager */}
      <CalendarLabelsManager
        open={labelsManagerOpen}
        onOpenChange={setLabelsManagerOpen}
        organizationId={organizationId}
      />

      {/* Day labels dialog */}
      <DayLabelsDialog
        open={!!dayLabelsFor}
        onOpenChange={(o) => !o && setDayLabelsFor(null)}
        organizationId={organizationId}
        date={dayLabelsFor}
        onOpenLabelsManager={() => {
          setDayLabelsFor(null);
          setLabelsManagerOpen(true);
        }}
      />

      {/* Appointment detail preview (from Dashboard) */}
      <AppointmentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        appointment={
          selectedDetailApt
            ? {
                title: selectedDetailApt.title,
                scheduled_at: selectedDetailApt.scheduled_at,
                notes: selectedDetailApt.notes,
                clientName: selectedDetailApt.clients?.full_name,
                completed_at: selectedDetailApt.completed_at,
                completion_notes: selectedDetailApt.completion_notes,
              }
            : null
        }
        onEdit={selectedDetailApt ? () => openEditAppointment(selectedDetailApt) : undefined}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function AppointmentRow({
  apt,
  onEdit,
  onDelete,
  displayName,
  past,
  onCompleted,
}: {
  apt: AppointmentWithClient;
  onEdit: (apt: AppointmentWithClient) => void;
  onDelete: (id: string) => void;
  displayName: (name: string) => string;
  past?: boolean;
  onCompleted?: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [editNotesOpen, setEditNotesOpen] = useState(false);
  const date = new Date(apt.scheduled_at);
  const today = isToday(date);
  const isCompleted = !!apt.completed_at;
  const isOverdue = !isCompleted && isPast(date) && !today;

  return (
    <>
      <Card
        onClick={() => setDetailOpen(true)}
        className={`px-3 py-2.5 space-y-1.5 w-full box-border min-w-0 overflow-hidden cursor-pointer transition-colors hover:bg-muted/40 ${isCompleted ? "opacity-70" : ""}`}
      >
        {/* Header: date + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center min-w-[44px] flex-shrink-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase">{format(date, "MMM", { locale: ptBR })}</p>
            <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-sm truncate" title={apt.title}>{apt.title}</p>
              {isCompleted && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 text-success px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
                  <CheckCircle className="h-2.5 w-2.5" /> Concluída
                </span>
              )}
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
                  Atrasada
                </span>
              )}
            </div>
            {apt.clients?.full_name ? (
              <p className="text-xs text-muted-foreground truncate">{displayName(apt.clients.full_name)}</p>
            ) : (
              <p className="text-xs text-muted-foreground/60 truncate italic">Compromisso pessoal</p>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {format(date, "EEEE, HH:mm", { locale: ptBR })}
          </span>
          {today && (
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
              Hoje
            </span>
          )}
        </div>

        {apt.notes && <p className="text-xs text-muted-foreground/70 truncate" title={apt.notes}>{apt.notes}</p>}
        {apt.address && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate" title={apt.address}>
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{apt.address}</span>
          </p>
        )}
        {apt.completion_notes && (
          <p className="text-xs text-primary line-clamp-2 whitespace-pre-wrap" title={apt.completion_notes}>📝 {apt.completion_notes}</p>
        )}

        {/* Route shortcut only — all other actions live inside the detail dialog */}
        {apt.address && (
          <div className="flex items-center pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => {
                const query = encodeURIComponent(apt.address!);
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
              }}
              className="h-8 px-3 gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-none transition-all"
            >
              <MapPin className="h-3.5 w-3.5" />
              Rota
            </Button>
          </div>
        )}
      </Card>
      <AppointmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={{
          title: apt.title,
          scheduled_at: apt.scheduled_at,
          notes: apt.notes,
          clientName: apt.clients?.full_name,
          completed_at: apt.completed_at,
          completion_notes: apt.completion_notes,
        }}
        onEdit={() => onEdit(apt)}
        onEditNotes={() => setEditNotesOpen(true)}
        onComplete={() => setCompleteOpen(true)}
        onDelete={() => onDelete(apt.id)}
      />
      <AppointmentCompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        appointmentId={apt.id}
        appointmentTitle={apt.title}
        onCompleted={() => onCompleted?.()}
      />
      <AppointmentCompleteDialog
        open={editNotesOpen}
        onOpenChange={setEditNotesOpen}
        appointmentId={apt.id}
        appointmentTitle={apt.title}
        editMode
        initialNotes={apt.completion_notes}
        onCompleted={() => onCompleted?.()}
      />
    </>
  );
}

function ServiceRow({
  svc,
  displayName,
  onSendBudget,
  onDelete,
  onViewPhotos,
}: {
  svc: ServiceRequestFull;
  displayName: (name: string) => string;
  onSendBudget: (svc: ServiceRequestFull) => void;
  onDelete: (id: string) => void;
  onViewPhotos: (data: { photos: string[]; comment: string | null; rating: number }) => void;
}) {
  const status = getServiceStatus(svc);
  const config = statusConfig[status] || statusConfig.pending;
  const hasScheduledDate = !!svc.scheduled_date;
  const scheduledDate = hasScheduledDate ? toZonedTime(new Date(svc.scheduled_date!), "America/Sao_Paulo") : null;

  return (
    <Card className="px-3 py-2.5 space-y-1.5 w-full box-border min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0">
        {hasScheduledDate && scheduledDate ? (
          <div className="text-center min-w-[44px] flex-shrink-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase">{format(scheduledDate, "MMM", { locale: ptBR })}</p>
            <p className="text-lg font-bold leading-tight">{format(scheduledDate, "dd")}</p>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium text-sm truncate">{svc.service_type}</p>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${config.color}`}>
              {config.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{displayName(svc.clients?.full_name || "")}</p>
        </div>
      </div>

      {/* Info */}
      {hasScheduledDate && scheduledDate && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {format(scheduledDate, "EEEE, HH:mm", { locale: ptBR })}
          </span>
          {isToday(scheduledDate) && (
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-medium">Hoje</span>
          )}
        </div>
      )}
      {svc.budget_value && (
        <p className="text-xs font-semibold text-primary">R$ {svc.budget_value.toFixed(2).replace(".", ",")}</p>
      )}
      {svc.preferred_date && !hasScheduledDate && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>Preferência: {format(toZonedTime(new Date(svc.preferred_date), "America/Sao_Paulo"), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
        </p>
      )}
      {svc.rating && (
        <div className="flex items-center gap-1 mt-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`h-3 w-3 ${s <= svc.rating! ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
          ))}
          {(svc.rating_photos?.length || svc.rating_comment) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[10px]"
              onClick={() => onViewPhotos({ photos: svc.rating_photos || [], comment: svc.rating_comment, rating: svc.rating! })}
            >
              <Eye className="h-3 w-3 mr-0.5" />
              Ver
            </Button>
          )}
        </div>
      )}

      {/* Actions row — like financial cards */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div />
        <div className="flex items-center gap-2">
          {status === "pending" && (
            <Button
              size="sm"
              onClick={() => onSendBudget(svc)}
              className="h-8 px-3 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow transition-all text-xs font-medium"
            >
              <Send className="h-3.5 w-3.5" />
              Orçar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(svc.id)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 transition-colors"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Calendar; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
