import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format, isToday, isPast, isFuture, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { SendBudgetDialog } from "@/components/dashboard/SendBudgetDialog";

// ─── Types ───────────────────────────────────────────────
interface AppointmentWithClient {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  client_id: string;
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
  clients: { full_name: string };
}

interface ClientOption {
  id: string;
  full_name: string;
}

type ServiceStatusFilter = "all" | "pending" | "budget_sent" | "accepted" | "completed" | "rejected";

// ─── Status helpers ──────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  budget_sent: { label: "Orçamento Enviado", color: "bg-purple-100 text-purple-800 border-purple-300" },
  accepted: { label: "Aceito", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "Recusado", color: "bg-red-100 text-red-800 border-red-300" },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-800 border-blue-300" },
};

const getServiceStatus = (svc: ServiceRequestFull) => {
  if (svc.completed_at) return "completed";
  return svc.status;
};

export default function Agenda() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<ServiceStatusFilter>("all");

  // Appointment form
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithClient | null>(null);
  const [aptTitle, setAptTitle] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptNotes, setAptNotes] = useState("");
  const [aptClientId, setAptClientId] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "appointment" | "service"; id: string } | null>(null);

  // Budget dialog
  const [budgetRequest, setBudgetRequest] = useState<{ id: string; client_id: string; service_type: string; client_name: string } | null>(null);

  // Photo viewer
  const [viewingPhotos, setViewingPhotos] = useState<{ photos: string[]; comment: string | null; rating: number } | null>(null);

  // ─── Queries ─────────────────────────────────────────────
  const { data: appointments, isLoading: loadingApts } = useQuery({
    queryKey: ["agenda-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AppointmentWithClient[];
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
        .select("id, full_name, user_id")
        .not("user_id", "is", null)
        .order("full_name");
      if (error) throw error;
      return data as ClientOption[];
    },
    enabled: appointmentDialog,
  });

  // ─── Mutations ───────────────────────────────────────────
  const saveAppointmentMutation = useMutation({
    mutationFn: async () => {
      // datetime-local gives "YYYY-MM-DDTHH:mm" in local time
      // Convert from Brazil timezone to UTC for storage
      const scheduledUtc = fromZonedTime(aptDate, "America/Sao_Paulo").toISOString();

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update({
            title: aptTitle,
            scheduled_at: scheduledUtc,
            notes: aptNotes || null,
          })
          .eq("id", editingAppointment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert({
          client_id: aptClientId,
          title: aptTitle,
          scheduled_at: scheduledUtc,
          notes: aptNotes || null,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      closeAppointmentDialog();
      toast.success(editingAppointment ? "Consulta atualizada!" : "Consulta agendada!");
    },
    onError: () => toast.error("Erro ao salvar consulta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: { type: string; id: string }) => {
      const table = target.type === "appointment" ? "appointments" : "service_requests";
      const { error } = await supabase.from(table).delete().eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: (_, target) => {
      queryClient.invalidateQueries({ queryKey: target.type === "appointment" ? ["agenda-appointments"] : ["agenda-services"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.success("Removido com sucesso!");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  // ─── Helpers ─────────────────────────────────────────────
  const closeAppointmentDialog = () => {
    setAppointmentDialog(false);
    setEditingAppointment(null);
    setAptTitle("");
    setAptDate("");
    setAptNotes("");
    setAptClientId("");
  };

  const openEditAppointment = (apt: AppointmentWithClient) => {
    setEditingAppointment(apt);
    setAptTitle(apt.title);
    const zonedDate = toZonedTime(new Date(apt.scheduled_at), "America/Sao_Paulo");
    setAptDate(format(zonedDate, "yyyy-MM-dd'T'HH:mm"));
    setAptNotes(apt.notes || "");
    setAptClientId(apt.client_id);
    setAppointmentDialog(true);
  };

  const displayName = (name: string) => {
    const parts = name.split(" ");
    if (parts.length <= 2) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  // ─── Filtering ───────────────────────────────────────────
  const filteredAppointments = (appointments || []).filter((apt) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return apt.title.toLowerCase().includes(term) || apt.clients?.full_name.toLowerCase().includes(term);
    }
    return true;
  });

  const filteredServices = (services || []).filter((svc) => {
    const status = getServiceStatus(svc);
    if (serviceStatusFilter !== "all" && status !== serviceStatusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return svc.service_type.toLowerCase().includes(term) || svc.clients?.full_name.toLowerCase().includes(term);
    }
    return true;
  });

  const futureApts = filteredAppointments.filter((a) => isFuture(new Date(a.scheduled_at)) || isToday(new Date(a.scheduled_at)));
  const pastApts = filteredAppointments.filter((a) => isPast(new Date(a.scheduled_at)) && !isToday(new Date(a.scheduled_at)));

  const isLoading = loadingApts || loadingSvc;

  // ─── Stats ───────────────────────────────────────────────
  const pendingServices = (services || []).filter(s => s.status === "pending").length;
  const budgetSentServices = (services || []).filter(s => s.status === "budget_sent").length;
  const acceptedServices = (services || []).filter(s => s.status === "accepted" && !s.completed_at).length;

  return (
    <div className="space-y-4 lg:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Agenda</h1>
          <p className="page-description">Consultas e serviços em um só lugar</p>
        </div>
        <Button onClick={() => setAppointmentDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Consulta
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-warning/10 border-warning/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingServices}</p>
            <p className="text-xs text-amber-700/80">Solicitações Pendentes</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{budgetSentServices}</p>
            <p className="text-xs text-primary/80">Aguardando Resposta</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{acceptedServices}</p>
            <p className="text-xs text-emerald-700/80">Em Andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou serviço..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">Tudo</TabsTrigger>
          <TabsTrigger value="appointments">
            Consultas
            {futureApts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{futureApts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="services">
            Serviços
            {pendingServices > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{pendingServices}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ─── ALL TAB ─── */}
            <TabsContent value="all" className="space-y-6 mt-4">
              {futureApts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Próximas Consultas
                  </h2>
                  <div className="space-y-2">
                    {futureApts.slice(0, 5).map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} />
                    ))}
                  </div>
                </section>
              )}
              {filteredServices.filter(s => s.status === "pending" || s.status === "budget_sent").length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Serviços que precisam de atenção
                  </h2>
                  <div className="space-y-2">
                    {filteredServices.filter(s => s.status === "pending" || s.status === "budget_sent").map((svc) => (
                      <ServiceRow key={svc.id} svc={svc} displayName={displayName} onSendBudget={(s) => setBudgetRequest({ id: s.id, client_id: s.client_id, service_type: s.service_type, client_name: s.clients?.full_name || "" })} onDelete={(id) => setDeleteTarget({ type: "service", id })} onViewPhotos={setViewingPhotos} />
                    ))}
                  </div>
                </section>
              )}
              {filteredServices.filter(s => s.status === "accepted" && !s.completed_at).length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Serviços em andamento
                  </h2>
                  <div className="space-y-2">
                    {filteredServices.filter(s => s.status === "accepted" && !s.completed_at).map((svc) => (
                      <ServiceRow key={svc.id} svc={svc} displayName={displayName} onSendBudget={() => {}} onDelete={(id) => setDeleteTarget({ type: "service", id })} onViewPhotos={setViewingPhotos} />
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            {/* ─── APPOINTMENTS TAB ─── */}
            <TabsContent value="appointments" className="space-y-6 mt-4">
              {futureApts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3">Próximas</h2>
                  <div className="space-y-2">
                    {futureApts.map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} />
                    ))}
                  </div>
                </section>
              )}
              {pastApts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3">Histórico</h2>
                  <div className="space-y-2">
                    {pastApts.map((apt) => (
                      <AppointmentRow key={apt.id} apt={apt} onEdit={openEditAppointment} onDelete={(id) => setDeleteTarget({ type: "appointment", id })} displayName={displayName} past />
                    ))}
                  </div>
                </section>
              )}
              {futureApts.length === 0 && pastApts.length === 0 && (
                <EmptyState icon={Calendar} message="Nenhuma consulta encontrada" />
              )}
            </TabsContent>

            {/* ─── SERVICES TAB ─── */}
            <TabsContent value="services" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={serviceStatusFilter} onValueChange={(v) => setServiceStatusFilter(v as ServiceStatusFilter)}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="budget_sent">Orçamento Enviado</SelectItem>
                    <SelectItem value="accepted">Aceitos</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="rejected">Recusados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {filteredServices.length > 0 ? (
                  filteredServices.map((svc) => (
                    <ServiceRow key={svc.id} svc={svc} displayName={displayName} onSendBudget={(s) => setBudgetRequest({ id: s.id, client_id: s.client_id, service_type: s.service_type, client_name: s.clients?.full_name || "" })} onDelete={(id) => setDeleteTarget({ type: "service", id })} onViewPhotos={setViewingPhotos} />
                  ))
                ) : (
                  <EmptyState icon={Briefcase} message="Nenhum serviço encontrado" />
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* ─── Dialogs ─── */}

      {/* Appointment Create/Edit */}
      <Dialog open={appointmentDialog} onOpenChange={(o) => !o && closeAppointmentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingAppointment ? "Editar Consulta" : "Nova Consulta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingAppointment && (
              <div>
                <Label className="text-xs">Cliente</Label>
                <Select value={aptClientId} onValueChange={setAptClientId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
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
              <Label className="text-xs">Título</Label>
              <Input placeholder="Ex: Consulta pré-natal" value={aptTitle} onChange={(e) => setAptTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data e hora</Label>
              <Input type="datetime-local" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea placeholder="Observações..." value={aptNotes} onChange={(e) => setAptNotes(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!aptTitle || !aptDate || (!editingAppointment && !aptClientId) || saveAppointmentMutation.isPending}
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
}: {
  apt: AppointmentWithClient;
  onEdit: (apt: AppointmentWithClient) => void;
  onDelete: (id: string) => void;
  displayName: (name: string) => string;
  past?: boolean;
}) {
  const date = new Date(apt.scheduled_at);
  const today = isToday(date);

  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 border bg-background hover:bg-muted/30 transition-colors ${past ? "opacity-50" : ""}`}>
      <div className="text-center min-w-[44px]">
        <p className="text-[10px] text-muted-foreground uppercase">{format(date, "MMM", { locale: ptBR })}</p>
        <p className="text-lg font-bold leading-tight">{format(date, "dd")}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{apt.title}</p>
          {today && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Hoje</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{displayName(apt.clients?.full_name || "")}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(date, "EEEE, HH:mm", { locale: ptBR })}
        </p>
        {apt.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{apt.notes}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(apt)} title="Editar">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(apt.id)} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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

  return (
    <div className="flex items-center gap-3 rounded-lg p-3 border bg-background hover:bg-muted/30 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Briefcase className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{svc.service_type}</p>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>{config.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{displayName(svc.clients?.full_name || "")}</p>
        {svc.budget_value && (
          <p className="text-xs font-semibold text-primary">R$ {svc.budget_value.toFixed(2).replace(".", ",")}</p>
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
      </div>
      <div className="flex items-center gap-1">
        {status === "pending" && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onSendBudget(svc)}>
            <Send className="h-3.5 w-3.5 mr-1" />
            Orçar
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(svc.id)} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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
