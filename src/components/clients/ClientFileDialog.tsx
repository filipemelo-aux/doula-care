import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Download,
  Loader2,
  User,
  Phone,
  MapPin,
  Heart,
  Baby,
  Stethoscope,
  Camera,
  Instagram,
  CreditCard,
  Calendar,
  BookHeart,
  Activity,
  FileSignature,
  Sparkles,
  AlertTriangle,
  ClipboardList,
  StickyNote,
} from "lucide-react";
import { cn, formatBrazilDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { usePlanNames } from "@/hooks/usePlanNames";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays } from "@/lib/pregnancy";
import { BIRTH_TYPE_LABELS } from "@/components/clients/BirthRegistrationDialog";

type Client = Tables<"clients">;

interface ClientFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const statusLabels: Record<string, string> = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Puérpera",
  outro: "Outro",
};

// Plan labels resolved dynamically via usePlanNames hook

const paymentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

const prenatalTypeLabels: Record<string, string> = {
  sus: "SUS",
  plano: "Plano de Saúde",
  particular: "Particular",
  equipe_particular: "Equipe Particular",
};

const emotionLabels: Record<string, string> = {
  happy: "😊 Feliz",
  calm: "😌 Calma",
  anxious: "😰 Ansiosa",
  sad: "😢 Triste",
  tired: "😴 Cansada",
  excited: "🤩 Animada",
  worried: "😟 Preocupada",
  grateful: "🙏 Grata",
};

const serviceRequestStatusLabels: Record<string, string> = {
  pending: "Pendente",
  budget_sent: "Orçamento enviado",
  approved: "Aprovado",
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
  rejected: "Rejeitado",
};

export function ClientFileDialog({ open, onOpenChange, client }: ClientFileDialogProps) {
  const { getPlanName } = usePlanNames();

  const { data: avatarUrl } = useQuery({
    queryKey: ["client-file-avatar", client?.user_id],
    enabled: open && !!client?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", client!.user_id!)
        .maybeSingle();
      return data?.avatar_url ?? null;
    },
  });

  const { data: appointments, isLoading: loadingAppts } = useQuery({
    queryKey: ["client-file-appointments", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", client!.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: diaryEntries, isLoading: loadingDiary } = useQuery({
    queryKey: ["client-file-diary", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pregnancy_diary")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: contractions, isLoading: loadingContractions } = useQuery({
    queryKey: ["client-file-contractions", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractions")
        .select("*")
        .eq("client_id", client!.id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: transactions } = useQuery({
    queryKey: ["client-file-transactions", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("client_id", client!.id)
        .eq("type", "receita")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: payments } = useQuery({
    queryKey: ["client-file-payments", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", client!.id)
        .order("installment_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: serviceRequests } = useQuery({
    queryKey: ["client-file-services", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  const { data: contracts } = useQuery({
    queryKey: ["client-file-contracts", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  // Notifications section was removed from the client file.
  // Cobranças (payment reminders) are now managed from the dedicated Cobranças page.
  const notifications: any[] = [];


  const isLoading = loadingAppts || loadingDiary || loadingContractions;

  if (!client) return null;

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const address = [client.street, client.number, client.neighborhood, client.city, client.state, client.zip_code]
    .filter(Boolean)
    .join(", ");

  const prenatalTeam = (() => {
    try {
      const team = client.prenatal_team as any[];
      if (Array.isArray(team) && team.length > 0) return team;
    } catch {}
    return null;
  })();

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let y = 20;
      const marginLeft = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxWidth = pageWidth - marginLeft * 2;

      const addText = (text: string, fontSize = 10, bold = false) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, marginLeft, y);
        y += lines.length * (fontSize * 0.5) + 2;
      };

      const addSection = (title: string) => {
        y += 4;
        if (y > 265) { doc.addPage(); y = 20; }
        doc.setDrawColor(200, 200, 200);
        doc.line(marginLeft, y, pageWidth - marginLeft, y);
        y += 6;
        addText(title, 13, true);
        y += 2;
      };

      // Header
      addText("FICHA DA CLIENTE", 18, true);
      addText(`Gerada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 9);
      y += 4;

      // Contractions
      if (contractions && contractions.length > 0) {
        addSection(`Contrações (${contractions.length})`);
        contractions.forEach((c) => {
          const dur = c.duration_seconds ? `${c.duration_seconds}s` : "em andamento";
          addText(`${formatDateTime(c.started_at)} — Duração: ${dur}`);
        });
      }

      // Appointments
      if (appointments && appointments.length > 0) {
        addSection(`Consultas (${appointments.length})`);
        appointments.forEach((apt) => {
          const status = apt.completed_at ? "✅ Concluída" : "⏳ Pendente";
          addText(`${formatDateTime(apt.scheduled_at)} — ${apt.title} [${status}]`, 10, true);
          if (apt.notes) addText(`  Observações: ${apt.notes}`);
          if (apt.completion_notes) addText(`  Notas de conclusão: ${apt.completion_notes}`);
        });
      }


      // Clinical
      if (client.prenatal_type || client.prenatal_high_risk || client.comorbidades || client.alergias || client.restricao_aromaterapia || client.birth_location) {
        addSection("Informações Clínicas");
        if (client.birth_location) addText(`Local do parto: ${client.birth_location}`);
        if (client.prenatal_type) addText(`Tipo de pré-natal: ${prenatalTypeLabels[client.prenatal_type] || client.prenatal_type}`);
        if (client.prenatal_high_risk) addText("⚠️ Gestação de alto risco");
        if (client.comorbidades) addText(`Comorbidades: ${client.comorbidades}`);
        if (client.alergias) addText(`Alergias: ${client.alergias}`);
        if (client.restricao_aromaterapia) addText(`Restrição aromaterapia: ${client.restricao_aromaterapia}`);
        if (prenatalTeam) {
          addText("Equipe de pré-natal:");
          prenatalTeam.forEach((m: any) => addText(`  • ${m.name}${m.role ? ` — ${m.role}` : ""}`));
        }
      }

      // Labor
      if (client.labor_started_at) {
        addSection("Trabalho de Parto");
        addText(`Início: ${formatDateTime(client.labor_started_at)}`);
      }

      // Birth
      if (client.birth_occurred) {
        addSection("Dados do Nascimento");
        if (client.birth_date) addText(`Data: ${formatDate(client.birth_date)}`);
        if (client.birth_time) addText(`Hora: ${client.birth_time}`);
        if ((client as any).birth_type) addText(`Tipo de parto: ${BIRTH_TYPE_LABELS[(client as any).birth_type] || (client as any).birth_type}`);
        if (client.birth_weight) addText(`Peso: ${client.birth_weight}g`);
        if (client.birth_height) addText(`Comprimento: ${client.birth_height}cm`);
        if (client.baby_names && client.baby_names.length > 0) addText(`Nome(s): ${client.baby_names.join(", ")}`);
      }

      // Personal Info
      addSection("Dados Pessoais");
      addText(`Nome: ${client.full_name}`);
      if (client.preferred_name) addText(`Nome preferido: ${client.preferred_name}`);
      addText(`Telefone: ${client.phone}`);
      if (client.cpf) addText(`CPF: ${client.cpf}`);
      addText(`Situação: ${client.status === "outro" && client.custom_status ? client.custom_status : statusLabels[client.status] || client.status}`);
      if (client.dpp) addText(`DPP: ${formatDate(client.dpp)}`);
      if (client.dpp || client.pregnancy_weeks) {
        const calcWeeks = calculateCurrentPregnancyWeeks(client.pregnancy_weeks, client.pregnancy_weeks_set_at, client.dpp);
        const calcDays = client.dpp ? calculateCurrentPregnancyDays(client.dpp) : 0;
        if (calcWeeks !== null) addText(`Semanas de gestação: ${calcWeeks}s${calcDays > 0 ? `${calcDays}d` : ""}`);
      }
      if (address) addText(`Endereço: ${address}`);
      addText(`Cadastrada em: ${formatDateTime(client.created_at)}`);

      // Companion
      if (client.companion_name || client.companion_phone) {
        addSection("Acompanhante");
        if (client.companion_name) addText(`Nome: ${client.companion_name}`);
        if (client.companion_phone) addText(`Telefone: ${client.companion_phone}`);
      }

      // Instagram
      if (client.instagram_gestante || client.instagram_acompanhante) {
        addSection("Instagram");
        if (client.instagram_gestante) addText(`Cliente: ${client.instagram_gestante}`);
        if (client.instagram_acompanhante) addText(`Acompanhante: ${client.instagram_acompanhante}`);
      }


      // Photographer
      if (client.has_fotografa && (client.fotografa_name || client.fotografa_phone)) {
        addSection("Fotógrafa");
        if (client.fotografa_name) addText(`Nome: ${client.fotografa_name}`);
        if (client.fotografa_phone) addText(`Telefone: ${client.fotografa_phone}`);
      }

      // Plan & Payment
      addSection("Plano e Pagamento");
      addText(`Plano: ${getPlanName(client.plan_setting_id, client.plan)}`);
      addText(`Valor: ${formatCurrency(Number(client.plan_value) || 0)}`);
      addText(`Pagamento: ${paymentMethodLabels[client.payment_method] || client.payment_method}`);
      addText(`Status: ${paymentStatusLabels[client.payment_status] || client.payment_status}`);

      if (payments && payments.length > 1) {
        addText("");
        addText("Parcelas:", 10, true);
        payments.forEach((p) => {
          const statusStr = p.status === "pago" ? "✅ Pago" : p.status === "parcial" ? "⚠️ Parcial" : "⏳ Pendente";
          const dueStr = p.due_date ? ` — Vence: ${formatDate(p.due_date)}` : "";
          addText(`  ${p.installment_number}/${p.total_installments}: ${formatCurrency(Number(p.amount))} [${statusStr}]${dueStr}`);
        });
      }

      // Contract
      if (contracts && contracts.length > 0) {
        addSection("Contratos");
        contracts.forEach((c) => {
          const st = c.status === "signed" ? "✅ Assinado" : "⏳ Pendente";
          addText(`${c.title} [${st}]`, 10, true);
          if (c.signed_at) addText(`  Assinado em: ${formatDateTime(c.signed_at)}`);
          if (c.signer_name) addText(`  Assinante: ${c.signer_name}`);
        });
      }

      // Service Requests
      if (serviceRequests && serviceRequests.length > 0) {
        addSection(`Solicitações de Serviço (${serviceRequests.length})`);
        serviceRequests.forEach((sr) => {
          const st = serviceRequestStatusLabels[sr.status] || sr.status;
          addText(`${sr.service_type} — ${st}`, 10, true);
          addText(`  Solicitado em: ${formatDateTime(sr.created_at)}`);
          if (sr.budget_value) addText(`  Orçamento: ${formatCurrency(Number(sr.budget_value))}`);
          if (sr.scheduled_date) addText(`  Agendado: ${formatDateTime(sr.scheduled_date)}`);
          if (sr.rating) addText(`  Avaliação: ${"⭐".repeat(sr.rating)}`);
          if (sr.rating_comment) addText(`  Comentário: ${sr.rating_comment}`);
        });
      }

      // Diary
      if (diaryEntries && diaryEntries.length > 0) {
        addSection(`Diário (${diaryEntries.length})`);
        diaryEntries.forEach((entry) => {
          const emotion = entry.emotion ? ` — ${emotionLabels[entry.emotion] || entry.emotion}` : "";
          addText(`${formatDateTime(entry.created_at)}${emotion}`, 10, true);
          addText(`  ${entry.content}`);
          if (entry.symptoms && entry.symptoms.length > 0) addText(`  Sintomas: ${entry.symptoms.join(", ")}`);
          if (entry.observations) addText(`  Obs: ${entry.observations}`);
        });
      }


      // Notifications section removed from PDF export.


      doc.save(`ficha-${client.full_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("Ficha exportada com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar ficha");
    }
  };

  const isPuer = client.status === "lactante";
  const calcWeeks = calculateCurrentPregnancyWeeks(client.pregnancy_weeks, client.pregnancy_weeks_set_at, client.dpp);
  const calcDays = client.dpp ? calculateCurrentPregnancyDays(client.dpp) : 0;
  const initials = client.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden gap-0 rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Ficha da Cliente</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[90vh]">
            {/* Hero */}
            <div
              className={cn(
                "relative px-6 pt-7 pb-6 bg-gradient-to-br",
                client.labor_started_at && !client.birth_occurred
                  ? "from-destructive/15 to-destructive/5"
                  : "from-primary/15 to-accent/5",
              )}
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16 shadow-md ring-2 ring-background">
                  <AvatarImage src={avatarUrl || undefined} alt={client.full_name} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25 text-primary font-semibold">
                    {initials || (isPuer ? <Heart className="w-6 h-6" /> : <Baby className="w-6 h-6" />)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-xl font-semibold text-foreground leading-tight break-words">
                    {client.preferred_name || client.full_name}
                  </h2>
                  {client.preferred_name && (
                    <p className="text-xs text-muted-foreground truncate">{client.full_name}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className={cn("badge-status border-0", `badge-${client.status}`)}>
                      {statusLabels[client.status] || client.status}
                    </Badge>
                    {calcWeeks !== null && !isPuer && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-5",
                          calcWeeks >= 40
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-primary/10 text-primary border-primary/20",
                        )}
                      >
                        {calcWeeks}s {calcDays}d
                      </Badge>
                    )}
                    {client.prenatal_high_risk && (
                      <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Alto risco
                      </Badge>
                    )}
                    {client.labor_started_at && !client.birth_occurred && (
                      <Badge className="text-[10px] h-5 bg-destructive text-destructive-foreground animate-pulse">
                        Em trabalho de parto
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 mt-4 w-full bg-background/60 backdrop-blur"
                onClick={handleExportPDF}
              >
                <Download className="w-4 h-4" />
                Exportar em PDF
              </Button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              {/* Contractions */}
              {contractions && contractions.length > 0 && (
                <Card icon={Activity} title={`Contrações (${contractions.length})`} tint="destructive">
                  <div className="space-y-1">
                    {contractions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                        <p>{formatDateTime(c.started_at)}</p>
                        <p className="font-medium">{c.duration_seconds ? `${c.duration_seconds}s` : "Em andamento"}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Appointments */}
              {appointments && appointments.length > 0 && (
                <Card icon={Calendar} title={`Consultas (${appointments.length})`} tint="accent">
                  <div className="space-y-2">
                    {appointments.map((apt) => (
                      <div key={apt.id} className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{apt.title}</p>
                          <Badge variant={apt.completed_at ? "default" : "outline"} className="text-[10px] h-5 shrink-0">
                            {apt.completed_at ? "Concluída" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(apt.scheduled_at)}</p>
                        {apt.notes && <p className="text-[11px]"><span className="text-muted-foreground">Obs:</span> {apt.notes}</p>}
                        {apt.completion_notes && <p className="text-[11px]"><span className="text-muted-foreground">Conclusão:</span> {apt.completion_notes}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}


              {/* Clinical */}
              {(client.prenatal_type || client.birth_location || client.comorbidades || client.alergias || client.restricao_aromaterapia || prenatalTeam) && (
                <Card icon={Stethoscope} title="Informações Clínicas" tint="primary">
                  <ChipGrid>
                    {client.birth_location && <Chip label="Local do parto" value={client.birth_location} />}
                    {client.prenatal_type && <Chip label="Pré-natal" value={prenatalTypeLabels[client.prenatal_type] || client.prenatal_type} />}
                  </ChipGrid>
                  {(client.comorbidades || client.alergias || client.restricao_aromaterapia) && (
                    <div className="space-y-2 mt-3">
                      {client.comorbidades && <TextBlock label="Comorbidades" value={client.comorbidades} />}
                      {client.alergias && <TextBlock label="Alergias" value={client.alergias} />}
                      {client.restricao_aromaterapia && <TextBlock label="Restrição aromaterapia" value={client.restricao_aromaterapia} />}
                    </div>
                  )}
                  {prenatalTeam && (
                    <div className="mt-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Equipe</p>
                      <div className="space-y-1">
                        {prenatalTeam.map((m: any, i: number) => (
                          <div key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                            <span className="font-medium">{m.name}</span>
                            {m.role && <span className="text-muted-foreground"> — {m.role}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Baby / Birth */}
              {(client.birth_occurred || (client.baby_names && client.baby_names.length > 0)) && (
                <Card icon={Baby} title={client.birth_occurred ? "Dados do Nascimento" : "Bebê"} tint="accent">
                  <ChipGrid>
                    {client.baby_names && client.baby_names.length > 0 && (
                      <Chip label="Nome(s)" value={client.baby_names.join(", ")} highlight />
                    )}
                    {client.birth_date && <Chip icon={Calendar} label="Data" value={formatDate(client.birth_date)} />}
                    {client.birth_time && <Chip label="Hora" value={client.birth_time} />}
                    {(client as any).birth_type && (
                      <Chip label="Tipo de parto" value={BIRTH_TYPE_LABELS[(client as any).birth_type] || (client as any).birth_type} highlight />
                    )}
                    {client.birth_weight && <Chip label="Peso" value={`${client.birth_weight}g`} />}
                    {client.birth_height && <Chip label="Comprimento" value={`${client.birth_height}cm`} />}
                  </ChipGrid>
                </Card>
              )}

              {/* Labor */}
              {client.labor_started_at && (
                <Card icon={Sparkles} title="Trabalho de Parto" tint="destructive">
                  <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs">
                    <p className="text-[10px] text-destructive uppercase tracking-wide">Início</p>
                    <p className="font-semibold text-destructive">{formatDateTime(client.labor_started_at)}</p>
                  </div>
                </Card>
              )}

              {/* Contact card */}
              <Card icon={User} title="Contato" tint="primary">
                <ChipGrid>
                  <Chip icon={Phone} label="Telefone" value={client.phone} />
                  {client.cpf && <Chip label="CPF" value={client.cpf} />}
                  {client.dpp && <Chip icon={Calendar} label="DPP" value={formatDate(client.dpp)} />}
                  <Chip label="Cadastrada em" value={formatDate(client.created_at)} />
                </ChipGrid>
                {address && (
                  <div className="flex items-start gap-2 mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{address}</p>
                  </div>
                )}
              </Card>

              {/* Companion */}
              {(client.companion_name || client.companion_phone) && (
                <Card icon={Heart} title="Acompanhante" tint="pink">
                  <ChipGrid>
                    {client.companion_name && <Chip label="Nome" value={client.companion_name} />}
                    {client.companion_phone && <Chip icon={Phone} label="Telefone" value={client.companion_phone} />}
                  </ChipGrid>
                </Card>
              )}

              {/* Instagram */}
              {(client.instagram_gestante || client.instagram_acompanhante) && (
                <Card icon={Instagram} title="Instagram" tint="accent">
                  <ChipGrid>
                    {client.instagram_gestante && <Chip icon={Instagram} label="Cliente" value={client.instagram_gestante} />}
                    {client.instagram_acompanhante && <Chip icon={Instagram} label="Acompanhante" value={client.instagram_acompanhante} />}
                  </ChipGrid>
                </Card>
              )}

              {/* Photographer */}
              {client.has_fotografa && (client.fotografa_name || client.fotografa_phone) && (
                <Card icon={Camera} title="Fotógrafa" tint="accent">
                  <ChipGrid>
                    {client.fotografa_name && <Chip icon={Camera} label="Nome" value={client.fotografa_name} />}
                    {client.fotografa_phone && <Chip icon={Phone} label="Telefone" value={client.fotografa_phone} />}
                  </ChipGrid>
                </Card>
              )}


              {/* Plan & Payment */}
              <Card icon={CreditCard} title="Plano e Pagamento" tint="primary">
                <ChipGrid>
                  <Chip label="Plano" value={getPlanName(client.plan_setting_id, client.plan)} highlight />
                  <Chip label="Valor" value={formatCurrency(Number(client.plan_value) || 0)} highlight />
                  <Chip label="Pagamento" value={paymentMethodLabels[client.payment_method] || client.payment_method} />
                  <Chip label="Status" value={paymentStatusLabels[client.payment_status] || client.payment_status} />
                </ChipGrid>

                {payments && payments.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Parcelas ({payments.length})
                    </p>
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                        <span className="font-medium">
                          {p.installment_number}/{p.total_installments} · {formatCurrency(Number(p.amount))}
                        </span>
                        <div className="flex items-center gap-2">
                          {p.due_date && <span className="text-muted-foreground text-[11px]">{formatDate(p.due_date)}</span>}
                          <Badge variant={p.status === "pago" ? "default" : "outline"} className="text-[10px] h-5">
                            {p.status === "pago" ? "Pago" : p.status === "parcial" ? "Parcial" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Contracts */}
              {contracts && contracts.length > 0 && (
                <Card icon={FileSignature} title={`Contratos (${contracts.length})`} tint="primary">
                  <div className="space-y-2">
                    {contracts.map((c) => (
                      <div key={c.id} className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{c.title}</p>
                          <Badge variant={c.status === "signed" ? "default" : "outline"} className="text-[10px] h-5 shrink-0">
                            {c.status === "signed" ? "Assinado" : "Pendente"}
                          </Badge>
                        </div>
                        {c.signed_at && <p className="text-[11px] text-muted-foreground">Assinado em {formatDateTime(c.signed_at)}</p>}
                        {c.signer_name && <p className="text-[11px] text-muted-foreground">Assinante: {c.signer_name}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Service Requests */}
              {serviceRequests && serviceRequests.length > 0 && (
                <Card icon={ClipboardList} title={`Solicitações de Serviço (${serviceRequests.length})`} tint="primary">
                  <div className="space-y-2">
                    {serviceRequests.map((sr) => (
                      <div key={sr.id} className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{sr.service_type}</p>
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {serviceRequestStatusLabels[sr.status] || sr.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(sr.created_at)}</p>
                        {sr.budget_value && <p className="text-[11px]"><span className="text-muted-foreground">Orçamento:</span> {formatCurrency(Number(sr.budget_value))}</p>}
                        {sr.scheduled_date && <p className="text-[11px]"><span className="text-muted-foreground">Agendado:</span> {formatDateTime(sr.scheduled_date)}</p>}
                        {sr.rating && <p className="text-[11px]"><span className="text-muted-foreground">Avaliação:</span> {"⭐".repeat(sr.rating)}</p>}
                        {sr.rating_comment && <p className="text-[11px]"><span className="text-muted-foreground">Comentário:</span> {sr.rating_comment}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Diary */}
              {diaryEntries && diaryEntries.length > 0 && (
                <Card icon={BookHeart} title={`Diário (${diaryEntries.length})`} tint="pink">
                  <div className="space-y-2">
                    {diaryEntries.map((entry) => (
                      <div key={entry.id} className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                          {entry.emotion && <span className="text-xs">{emotionLabels[entry.emotion] || entry.emotion}</span>}
                        </div>
                        <p className="text-xs">{entry.content}</p>
                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.symptoms.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] h-4">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.observations && <p className="text-[11px] text-muted-foreground">Obs: {entry.observations}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}


              {(!appointments || appointments.length === 0) &&
                (!diaryEntries || diaryEntries.length === 0) &&
                (!contractions || contractions.length === 0) &&
                (!serviceRequests || serviceRequests.length === 0) && (
                  <p className="text-center text-muted-foreground text-xs py-2">
                    Nenhum registro de acompanhamento ainda.
                  </p>
                )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

const tintClasses: Record<string, { bg: string; icon: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary" },
  accent: { bg: "bg-accent/20", icon: "text-accent-foreground" },
  pink: { bg: "bg-pink-100", icon: "text-pink-600" },
  destructive: { bg: "bg-destructive/10", icon: "text-destructive" },
};

function Card({
  icon: Icon,
  title,
  tint = "primary",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint?: "primary" | "accent" | "pink" | "destructive";
  children: React.ReactNode;
}) {
  const t = tintClasses[tint];
  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", t.bg)}>
          <Icon className={cn("w-4 h-4", t.icon)} />
        </div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Chip({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 min-w-0",
        highlight ? "bg-primary/10" : "bg-muted/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-primary shrink-0" />}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className={cn("text-xs font-medium break-words", highlight && "text-primary")}>{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}

