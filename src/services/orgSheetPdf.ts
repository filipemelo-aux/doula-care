import { supabase } from "@/integrations/supabase/client";
import { maskCPF, maskPhone } from "@/lib/masks";
import { formatInTimeZone } from "date-fns-tz";

const date = (value?: string | null) => {
  if (!value) return "Não informado";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value);
  return Number.isNaN(parsed.getTime()) ? "Não informado" : formatInTimeZone(parsed, "America/Sao_Paulo", "dd/MM/yyyy");
};

/** Gera uma ficha resumida por página, sem incluir dados das clientes. */
export async function generateOrgSheetsPdf(ids: string[]) {
  if (!ids.length) throw new Error("Selecione uma organização");
  const [{ data: orgs, error: orgError }, { data: profiles, error: profileError }, { data: personal, error: personalError }] = await Promise.all([
    supabase.from("organizations").select("*").in("id", ids),
    supabase.from("profiles").select("organization_id,user_id,full_name,lgpd_consent_at,profile_completed_at").in("organization_id", ids),
    supabase.from("doula_personal_data").select("organization_id,user_id,cpf,birth_date").in("organization_id", ids),
  ]);
  if (orgError || profileError || personalError) throw orgError || profileError || personalError;
  if (!orgs || orgs.length !== ids.length) throw new Error("Não foi possível carregar todas as fichas");
  const userIds = (profiles || []).map((p) => p.user_id);
  const rolesResult = userIds.length
    ? await supabase.from("user_roles").select("user_id,role").in("user_id", userIds)
    : { data: [], error: null };
  if (rolesResult.error) throw rolesResult.error;

  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: "Fichas das organizações - Doula Care" });
  ids.forEach((id, index) => {
    const org = orgs.find((o) => o.id === id);
    if (!org) throw new Error("Organização não encontrada");
    if (index) pdf.addPage();
    const staff = (profiles || []).filter((p) => p.organization_id === id);
    const owner = staff.find((p) => rolesResult.data?.some((r) => r.user_id === p.user_id && r.role === "admin")) || staff[0];
    const ownerPersonal = (personal || []).find((p) => p.organization_id === id && p.user_id === owner?.user_id);
    const sections: [string, [string, unknown][]][] = [
      ["Identificação", [
        ["Nome / Razão", org.name], ["Nome de exibição", org.nome_exibicao],
        ["Plano", org.plan === "premium" ? "Premium" : org.plan === "pro" ? "Pro" : "Free"],
        ["Situação", org.status === "ativo" ? "Ativa" : org.status === "suspenso" ? "Suspensa" : "Pendente"],
        ["Cadastrada em", date(org.created_at)],
      ]],
      ["Dados da doula", [
        ["Nome completo", owner?.full_name], ["CPF", ownerPersonal?.cpf ? maskCPF(ownerPersonal.cpf) : null],
        ["Nascimento", date(ownerPersonal?.birth_date)], ["Cadastro completo", owner?.profile_completed_at ? date(owner.profile_completed_at) : "Pendente"],
        ["Consentimento LGPD", owner?.lgpd_consent_at ? date(owner.lgpd_consent_at) : "Não registrado"],
      ]],
      ["Contato", [
        ["E-mail", org.responsible_email], ["WhatsApp", org.whatsapp ? maskPhone(org.whatsapp) : null],
        ["Instagram", org.instagram ? `@${org.instagram.replace(/^@/, "")}` : null],
      ]],
      ["Endereço e atuação", [
        ["CEP", org.postal_code], ["Rua / Número", [org.street, org.street_number].filter(Boolean).join(", ")],
        ["Bairro", org.neighborhood], ["Cidade / UF", [org.city, org.state].filter(Boolean).join(" / ")],
        ["Áreas de atendimento", (org.service_areas || []).join(", ")],
        ["Aceita novas clientes", org.accepts_new_clients ? "Sim" : "Não"],
      ]],
      ["Perfil profissional", [
        ["Formação", org.doula_training], ["Atua desde", org.practice_since], ["Bio", org.bio],
      ]],
      ["Assinatura e cobrança", [["Ciclo de cobrança", org.billing_cycle], ["Próxima cobrança", date(org.next_billing_date)]]],
    ];

    // Ajusta o tamanho para preservar todo o conteúdo em uma única página A4.
    const measure = (fontSize: number) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      return sections.map(([title, rows]) => ({
        title,
        rows: rows.map(([label, value]) => ({
          label,
          lines: pdf.splitTextToSize(String(value ?? "").trim() || "Não informado", 125) as string[],
        })),
      }));
    };
    let fontSize = 10;
    let layout = measure(fontSize);
    const height = () => layout.reduce((total, section) => total + 9 + section.rows.reduce((sum, row) => sum + Math.max(1, row.lines.length) * fontSize * 0.42 + 1.4, 0), 0);
    while (height() > 235 && fontSize > 5) {
      fontSize -= 0.5;
      layout = measure(fontSize);
    }
    if (height() > 235) throw new Error("Ficha muito extensa para uma página. Reduza a bio antes de imprimir.");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("Doula Care | Ficha da organização", 18, 20);
    pdf.setFontSize(11);
    const name = org.nome_exibicao?.trim() || org.name;
    pdf.text(pdf.splitTextToSize(name, 174).slice(0, 2), 18, 28);
    let y = 40;
    for (const section of layout) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fontSize + 1);
      pdf.text(section.title, 18, y);
      y += 6;
      for (const row of section.rows) {
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(row.label, 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(row.lines, 67, y, { lineHeightFactor: 1.19 });
        y += Math.max(1, row.lines.length) * fontSize * 0.42 + 1.4;
      }
      y += 3;
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Gerado em ${date(new Date().toISOString())} | ${index + 1}/${ids.length}`, 18, 287);
  });
  return pdf;
}