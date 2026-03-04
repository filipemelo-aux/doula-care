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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn, formatBrazilDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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

const planLabels: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
  avulso: "Avulso",
};

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

  const { data: notifications } = useQuery({
    queryKey: ["client-file-notifications", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

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

      // Personal Info
      addSection("Dados Pessoais");
      addText(`Nome: ${client.full_name}`);
      if (client.preferred_name) addText(`Nome preferido: ${client.preferred_name}`);
      addText(`Telefone: ${client.phone}`);
      if (client.cpf) addText(`CPF: ${client.cpf}`);
      addText(`Situação: ${client.status === "outro" && client.custom_status ? client.custom_status : statusLabels[client.status] || client.status}`);
      if (client.dpp) addText(`DPP: ${formatDate(client.dpp)}`);
      if (client.pregnancy_weeks) addText(`Semanas de gestação: ${client.pregnancy_weeks}`);
      if (address) addText(`Endereço: ${address}`);
      addText(`Cadastrada em: ${formatDateTime(client.created_at)}`);

      // Companion
      if (client.companion_name || client.companion_phone) {
        addSection("Acompanhante");
        if (client.companion_name) addText(`Nome: ${client.companion_name}`);
        if (client.companion_phone) addText(`Telefone: ${client.companion_phone}`);
        if (client.instagram_acompanhante) addText(`Instagram: ${client.instagram_acompanhante}`);
      }

      // Social
      if (client.instagram_gestante) {
        addSection("Redes Sociais");
        addText(`Instagram: ${client.instagram_gestante}`);
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

      // Photographer
      if (client.has_fotografa && (client.fotografa_name || client.fotografa_phone)) {
        addSection("Fotógrafa");
        if (client.fotografa_name) addText(`Nome: ${client.fotografa_name}`);
        if (client.fotografa_phone) addText(`Telefone: ${client.fotografa_phone}`);
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
        if (client.birth_weight) addText(`Peso: ${client.birth_weight}g`);
        if (client.birth_height) addText(`Comprimento: ${client.birth_height}cm`);
        if (client.baby_names && client.baby_names.length > 0) addText(`Nome(s): ${client.baby_names.join(", ")}`);
      }

      // Plan & Payment
      addSection("Plano e Pagamento");
      addText(`Plano: ${planLabels[client.plan] || client.plan}`);
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

      // Contractions
      if (contractions && contractions.length > 0) {
        addSection(`Contrações (${contractions.length})`);
        contractions.forEach((c) => {
          const dur = c.duration_seconds ? `${c.duration_seconds}s` : "em andamento";
          addText(`${formatDateTime(c.started_at)} — Duração: ${dur}`);
        });
      }

      // Notifications
      if (notifications && notifications.length > 0) {
        addSection(`Notificações Enviadas (${notifications.length})`);
        notifications.forEach((n) => {
          addText(`${formatDateTime(n.created_at)} — ${n.title}`, 10, true);
          addText(`  ${n.message}`);
        });
      }

      doc.save(`ficha-${client.full_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("Ficha exportada com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar ficha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle className="font-display text-xl">Ficha da Cliente</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleExportPDF}
            disabled={isLoading}
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Personal */}
              <Section title="Dados Pessoais">
                <Field label="Nome" value={client.full_name} />
                {client.preferred_name && <Field label="Nome preferido" value={client.preferred_name} />}
                <Field label="Telefone" value={client.phone} />
                {client.cpf && <Field label="CPF" value={client.cpf} />}
                <Field
                  label="Situação"
                  value={client.status === "outro" && client.custom_status ? client.custom_status : statusLabels[client.status] || client.status}
                />
                {client.dpp && <Field label="DPP" value={formatDate(client.dpp)} />}
                {client.pregnancy_weeks && <Field label="Semanas" value={`${client.pregnancy_weeks}`} />}
                {address && <Field label="Endereço" value={address} fullWidth />}
                <Field label="Cadastrada em" value={formatDateTime(client.created_at)} />
              </Section>

              {/* Companion */}
              {(client.companion_name || client.companion_phone) && (
                <Section title="Acompanhante">
                  {client.companion_name && <Field label="Nome" value={client.companion_name} />}
                  {client.companion_phone && <Field label="Telefone" value={client.companion_phone} />}
                  {client.instagram_acompanhante && <Field label="Instagram" value={client.instagram_acompanhante} />}
                </Section>
              )}

              {/* Social */}
              {client.instagram_gestante && (
                <Section title="Redes Sociais">
                  <Field label="Instagram" value={client.instagram_gestante} />
                </Section>
              )}

              {/* Clinical */}
              {(client.prenatal_type || client.prenatal_high_risk || client.comorbidades || client.alergias || client.restricao_aromaterapia || client.birth_location) && (
                <Section title="Informações Clínicas">
                  {client.birth_location && <Field label="Local do parto" value={client.birth_location} />}
                  {client.prenatal_type && <Field label="Pré-natal" value={prenatalTypeLabels[client.prenatal_type] || client.prenatal_type} />}
                  {client.prenatal_high_risk && (
                    <div className="col-span-2">
                      <Badge variant="destructive" className="text-xs">⚠️ Alto Risco</Badge>
                    </div>
                  )}
                  {client.comorbidades && <Field label="Comorbidades" value={client.comorbidades} fullWidth />}
                  {client.alergias && <Field label="Alergias" value={client.alergias} fullWidth />}
                  {client.restricao_aromaterapia && <Field label="Restrição aromaterapia" value={client.restricao_aromaterapia} fullWidth />}
                  {prenatalTeam && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Equipe</p>
                      {prenatalTeam.map((m: any, i: number) => (
                        <p key={i} className="font-medium">{m.name}{m.role ? ` — ${m.role}` : ""}</p>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Photographer */}
              {client.has_fotografa && (client.fotografa_name || client.fotografa_phone) && (
                <Section title="Fotógrafa">
                  {client.fotografa_name && <Field label="Nome" value={client.fotografa_name} />}
                  {client.fotografa_phone && <Field label="Telefone" value={client.fotografa_phone} />}
                </Section>
              )}

              {/* Labor */}
              {client.labor_started_at && (
                <Section title="Trabalho de Parto">
                  <Field label="Início" value={formatDateTime(client.labor_started_at)} />
                </Section>
              )}

              {/* Birth */}
              {client.birth_occurred && (
                <Section title="Dados do Nascimento">
                  {client.birth_date && <Field label="Data" value={formatDate(client.birth_date)} />}
                  {client.birth_time && <Field label="Hora" value={client.birth_time} />}
                  {client.birth_weight && <Field label="Peso" value={`${client.birth_weight}g`} />}
                  {client.birth_height && <Field label="Comprimento" value={`${client.birth_height}cm`} />}
                  {client.baby_names && client.baby_names.length > 0 && (
                    <Field label="Nome(s)" value={client.baby_names.join(", ")} />
                  )}
                </Section>
              )}

              {/* Plan & Payment */}
              <Section title="Plano e Pagamento">
                <Field label="Plano" value={planLabels[client.plan] || client.plan} />
                <Field label="Valor" value={formatCurrency(Number(client.plan_value) || 0)} />
                <Field label="Pagamento" value={paymentMethodLabels[client.payment_method] || client.payment_method} />
                <Field label="Status" value={paymentStatusLabels[client.payment_status] || client.payment_status} />
              </Section>

              {/* Installments */}
              {payments && payments.length > 1 && (
                <Section title={`Parcelas (${payments.length})`}>
                  <div className="col-span-2 space-y-1">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                        <span className="font-medium">{p.installment_number}/{p.total_installments} — {formatCurrency(Number(p.amount))}</span>
                        <div className="flex items-center gap-2">
                          {p.due_date && <span className="text-muted-foreground">{formatDate(p.due_date)}</span>}
                          <Badge variant={p.status === "pago" ? "default" : "outline"} className="text-[10px] h-5">
                            {p.status === "pago" ? "Pago" : p.status === "parcial" ? "Parcial" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Contracts */}
              {contracts && contracts.length > 0 && (
                <Section title={`Contratos (${contracts.length})`}>
                  <div className="col-span-2 space-y-2">
                    {contracts.map((c) => (
                      <div key={c.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{c.title}</p>
                          <Badge variant={c.status === "signed" ? "default" : "outline"} className="text-[10px] h-5 shrink-0">
                            {c.status === "signed" ? "Assinado" : "Pendente"}
                          </Badge>
                        </div>
                        {c.signed_at && <p className="text-xs text-muted-foreground">Assinado em {formatDateTime(c.signed_at)}</p>}
                        {c.signer_name && <p className="text-xs text-muted-foreground">Assinante: {c.signer_name}</p>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Appointments */}
              {appointments && appointments.length > 0 && (
                <Section title={`Consultas (${appointments.length})`}>
                  <div className="col-span-2 space-y-3">
                    {appointments.map((apt) => (
                      <div key={apt.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{apt.title}</p>
                          <Badge variant={apt.completed_at ? "default" : "outline"} className="text-[10px] h-5 shrink-0">
                            {apt.completed_at ? "Concluída" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{formatDateTime(apt.scheduled_at)}</p>
                        {apt.notes && (
                          <p className="text-xs"><span className="text-muted-foreground">Obs:</span> {apt.notes}</p>
                        )}
                        {apt.completion_notes && (
                          <p className="text-xs"><span className="text-muted-foreground">Conclusão:</span> {apt.completion_notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Service Requests */}
              {serviceRequests && serviceRequests.length > 0 && (
                <Section title={`Solicitações de Serviço (${serviceRequests.length})`}>
                  <div className="col-span-2 space-y-3">
                    {serviceRequests.map((sr) => (
                      <div key={sr.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{sr.service_type}</p>
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {serviceRequestStatusLabels[sr.status] || sr.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{formatDateTime(sr.created_at)}</p>
                        {sr.budget_value && (
                          <p className="text-xs"><span className="text-muted-foreground">Orçamento:</span> {formatCurrency(Number(sr.budget_value))}</p>
                        )}
                        {sr.scheduled_date && (
                          <p className="text-xs"><span className="text-muted-foreground">Agendado:</span> {formatDateTime(sr.scheduled_date)}</p>
                        )}
                        {sr.rating && (
                          <p className="text-xs"><span className="text-muted-foreground">Avaliação:</span> {"⭐".repeat(sr.rating)}</p>
                        )}
                        {sr.rating_comment && (
                          <p className="text-xs"><span className="text-muted-foreground">Comentário:</span> {sr.rating_comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Diary */}
              {diaryEntries && diaryEntries.length > 0 && (
                <Section title={`Diário (${diaryEntries.length})`}>
                  <div className="col-span-2 space-y-3">
                    {diaryEntries.map((entry) => (
                      <div key={entry.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                          {entry.emotion && (
                            <span className="text-xs">{emotionLabels[entry.emotion] || entry.emotion}</span>
                          )}
                        </div>
                        <p className="text-xs">{entry.content}</p>
                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.symptoms.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] h-4">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.observations && (
                          <p className="text-xs text-muted-foreground">Obs: {entry.observations}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Contractions */}
              {contractions && contractions.length > 0 && (
                <Section title={`Contrações (${contractions.length})`}>
                  <div className="col-span-2 space-y-1">
                    {contractions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <p className="text-xs">{formatDateTime(c.started_at)}</p>
                        <p className="text-xs font-medium">
                          {c.duration_seconds ? `${c.duration_seconds}s` : "Em andamento"}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Notifications sent */}
              {notifications && notifications.length > 0 && (
                <Section title={`Notificações Enviadas (${notifications.length})`}>
                  <div className="col-span-2 space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-xs">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(n.created_at)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Empty state */}
              {(!appointments || appointments.length === 0) &&
                (!diaryEntries || diaryEntries.length === 0) &&
                (!contractions || contractions.length === 0) &&
                (!serviceRequests || serviceRequests.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum registro de acompanhamento encontrado.
                  </p>
                )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Separator />
      <h3 className="font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : "col-span-2 sm:col-span-1"}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
