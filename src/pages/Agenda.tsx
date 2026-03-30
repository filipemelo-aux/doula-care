import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { format, isToday, isPast, isFuture, parseISO, isSameDay, startOfDay, addHours, isBefore, isAfter, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { SendBudgetDialog } from "@/components/dashboard/SendBudgetDialog";
import { NewServiceDialog } from "@/components/agenda/NewServiceDialog";
import { AvailabilityManager } from "@/components/agenda/AvailabilityManager";
import { AppointmentRequestsSection } from "@/components/agenda/AppointmentRequestsSection";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchAddressByCep, formatAddressWithNumber } from "@/lib/address";
import { maskCEP } from "@/lib/masks";

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });

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

  // An appointment is "em andamento" only if current time is within the scheduled hour
  const getAppointmentStatus = (apt: AppointmentWithClient) => {
    if (apt.completed_at) return "completed";
    const scheduledTime = new Date(apt.scheduled_at);
    const scheduledEnd = addHours(scheduledTime, 1);
    if (isWithinInterval(now, { start: scheduledTime, end: scheduledEnd })) return "in_progress";
    if (isBefore(now, scheduledTime)) return "future";
    return "past";
  };

  const futureApts = filteredAppointments.filter((a) => {
    const status = getAppointmentStatus(a);
    return status === "future" || status === "in_progress";
  });
  const pastApts = filteredAppointments.filter((a) => {
    const status = getAppointmentStatus(a);
    return status === "past" && !a.completed_at;
  }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const completedApts = filteredAppointments.filter((a) => !!a.completed_at).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

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
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={() => setServiceDialog(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo serviço</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setAppointmentDialog(true)} className="gap-2.5 py-2.5">
                <Calendar className="h-4 w-4" /> Nova consulta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPersonalAptDialog(true)} className="gap-2.5 py-2.5">
                <CalendarCheck className="h-4 w-4" /> Compromisso pessoal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Stats — gradient block like financial */}
       <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-card">
        <p className="text-xs text-muted-foreground/70 mb-0.5">Compromissos futuros</p>
        <p className="text-3xl font-bold tracking-tight text-primary">{allApts.filter(a => !a.completed_at && isFuture(new Date(a.scheduled_at))).length}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground/60 font-normal">Pendentes</p>
            <p className="text-sm font-semibold text-amber-600">{pendingServices}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground/60 font-normal">Aguardando</p>
            <p className="text-sm font-semibold text-foreground/80">{budgetSentServices}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground/60 font-normal">Em andamento</p>
            <p className="text-sm font-semibold text-success">{inProgressApts}</p>
          </div>
        </div>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por cliente ou compromisso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "list" | "calendar")}>
          <ToggleGroupItem value="list" aria-label="Lista" className="h-10 w-10">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label="Disponibilidade" className="h-10 w-10">
            <CalendarDays className="h-4 w-4" />
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
          <ToggleGroup
            type="single"
            value={agendaFilter}
            onValueChange={(v) => v && setAgendaFilter(v as AgendaFilter)}
            className="w-full"
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

          {/* Inline calendar when filter is "calendar" */}
          {agendaFilter === "calendar" && (
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
                  }}
                  modifiersClassNames={{
                    hasAppointment: "has-appointment",
                  }}
                />
                <style>{`
                  .has-appointment::after {
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
                  .has-appointment {
                    position: relative;
                  }
                `}</style>
              </CardContent>
            </Card>
          )}

          {/* Appointment Requests */}
          <AppointmentRequestsSection />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Date header when calendar filter */}
              {agendaFilter === "calendar" && (
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM, EEEE", { locale: ptBR })}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filteredAppointments.length}
                  </Badge>
                </h2>
              )}

              {/* In-progress appointments */}
              {filteredAppointments.filter(a => getAppointmentStatus(a) === "in_progress").length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Em andamento agora
                  </h2>
                  <div className="space-y-2">
                    {filteredAppointments.filter(a => getAppointmentStatus(a) === "in_progress").map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} onCompleted={() => queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] })} />
                    ))}
                  </div>
                </section>
              )}

              {/* Future appointments */}
              {futureApts.filter(a => getAppointmentStatus(a) === "future").length > 0 && (
                <section>
                  <div className="space-y-2">
                    {futureApts.filter(a => getAppointmentStatus(a) === "future").map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} onCompleted={() => queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] })} />
                    ))}
                  </div>
                </section>
              )}

              {/* Services needing attention */}
              {filteredServices.filter(s => s.status === "pending" || s.status === "budget_sent" || s.status === "date_proposed").length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Serviços que precisam de atenção
                  </h2>
                  <div className="space-y-2">
                    {filteredServices.filter(s => s.status === "pending" || s.status === "budget_sent" || s.status === "date_proposed").map((svc) => (
                      <ServiceRow key={svc.id} svc={svc} displayName={displayName} onSendBudget={(s) => setBudgetRequest({ id: s.id, client_id: s.client_id, service_type: s.service_type, client_name: s.clients?.full_name || "", preferred_date: s.preferred_date })} onDelete={(id) => setDeleteTarget({ type: "service", id })} onViewPhotos={setViewingPhotos} />
                    ))}
                  </div>
                </section>
              )}

              {/* Past / completed appointments */}
              {(pastApts.length > 0 || completedApts.length > 0) && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Histórico
                  </h2>
                  <div className="space-y-2">
                    {[...completedApts, ...pastApts].map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} past onCompleted={() => queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] })} />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {filteredAppointments.length === 0 && filteredServices.length === 0 && (
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
  const date = new Date(apt.scheduled_at);
  const today = isToday(date);

  return (
    <>
      <Card className={`px-3 py-2.5 space-y-1.5 w-full box-border min-w-0 overflow-hidden ${apt.completed_at ? "opacity-60" : past ? "opacity-50" : ""}`}>
        {/* Header: date + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center min-w-[44px] flex-shrink-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase">{format(date, "MMM", { locale: ptBR })}</p>
            <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm truncate" title={apt.title}>{apt.title}</p>
              {apt.completed_at && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 text-success px-1.5 py-0 text-[10px] font-medium flex-shrink-0">
                  <CheckCircle className="h-2.5 w-2.5" /> Concluída
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

        {apt.notes && <p className="text-xs text-muted-foreground/70 truncate">{apt.notes}</p>}
        {apt.address && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate" title={apt.address}>
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{apt.address}</span>
          </p>
        )}
        {apt.completion_notes && (
          <p className="text-xs text-primary truncate" title={apt.completion_notes}>📝 {apt.completion_notes}</p>
        )}

        {/* Actions row — like financial cards */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5">
            {apt.address && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const query = encodeURIComponent(apt.address!);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
                }}
                className="h-8 px-3 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
              >
                <MapPinned className="h-3.5 w-3.5" />
                Rota
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!apt.completed_at && (
              <Button
                size="sm"
                onClick={() => setCompleteOpen(true)}
                className="h-8 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all text-xs font-medium"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Concluir
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-muted-foreground flex-shrink-0 hover:bg-muted transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 animate-fade-in">
                <DropdownMenuItem onClick={() => setDetailOpen(true)} className="gap-2.5 text-xs py-2.5 cursor-pointer transition-colors">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  Ver detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(apt)} className="gap-2.5 text-xs py-2.5 cursor-pointer transition-colors">
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(apt.id)} className="gap-2.5 text-xs py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
      />
      <AppointmentCompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        appointmentId={apt.id}
        appointmentTitle={apt.title}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-muted-foreground flex-shrink-0 hover:bg-muted transition-colors">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 animate-fade-in">
              <DropdownMenuItem onClick={() => onDelete(svc.id)} className="gap-2.5 text-xs py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
