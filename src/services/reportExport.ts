import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PeriodOption, getPeriodDates, getPeriodLabel } from "@/components/dashboard/PeriodFilter";
import { supabase } from "@/integrations/supabase/client";

export type ReportTab = "financeiro" | "clientes" | "receitas" | "despesas";
export type ExportFormat = "csv" | "pdf" | "xlsx";

interface TransactionRow {
  date: string;
  description: string;
  type: string;
  amount: number;
  amount_received: number | null;
  payment_method: string | null;
  expense_category: string | null;
}

interface ClientRow {
  full_name: string;
  status: string;
  plan: string;
  phone: string;
  plan_value: number | null;
  payment_status: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const methodLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

const categoryLabels: Record<string, string> = {
  social_media: "Social Media",
  filmmaker: "Filmmaker",
  marketing: "Marketing",
  material_hospitalar: "Mat. Hospitalar",
  material_escritorio: "Mat. Escritório",
  transporte: "Transporte",
  formacao: "Formação",
  equipamentos: "Equipamentos",
  servicos_terceiros: "Serv. Terceiros",
  outros: "Outros",
};

const statusLabels: Record<string, string> = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Lactante",
};

const planLabels: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
};

const paymentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

function buildFileName(tab: ReportTab, period: PeriodOption): string {
  const periodLabel = getPeriodLabel(period)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
  const dateStr = format(new Date(), "yyyy-MM-dd");
  return `${tab}_${periodLabel}_${dateStr}`;
}

async function fetchReportData(tab: ReportTab, period: PeriodOption) {
  const { start, end } = getPeriodDates(period);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  if (tab === "clientes") {
    const { data } = await supabase
      .from("clients")
      .select("full_name, status, plan, phone, plan_value, payment_status");
    return { clients: (data || []) as ClientRow[] };
  }

  // All financial tabs use transactions
  const query = supabase
    .from("transactions")
    .select("date, description, type, amount, amount_received, payment_method, expense_category")
    .gte("date", startStr)
    .lte("date", endStr);

  if (tab === "receitas") query.eq("type", "receita");
  if (tab === "despesas") query.eq("type", "despesa");

  const { data } = await query.order("date", { ascending: false });
  const transactions = (data || []) as TransactionRow[];

  const income = transactions.filter((t) => t.type === "receita");
  const expenses = transactions.filter((t) => t.type === "despesa");

  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = income.reduce((s, t) => s + Number(t.amount_received || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);

  return {
    transactions,
    summary: {
      totalIncome,
      totalReceived,
      totalPending: totalIncome - totalReceived,
      totalExpenses,
      balance: totalReceived - totalExpenses,
    },
  };
}

// ─── CSV ────────────────────────────────────────────────────
function downloadCSV(content: string, fileName: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${fileName}.csv`);
}

function buildCSV(tab: ReportTab, data: Awaited<ReturnType<typeof fetchReportData>>, period: PeriodOption): string {
  const lines: string[] = [];

  if (tab === "clientes" && "clients" in data) {
    lines.push("Nome,Status,Plano,Telefone,Valor do Plano,Status Pagamento");
    data.clients.forEach((c) => {
      lines.push(
        `"${c.full_name}",${statusLabels[c.status] || c.status},${planLabels[c.plan] || c.plan},"${c.phone}",${c.plan_value || 0},${paymentStatusLabels[c.payment_status] || c.payment_status}`
      );
    });
    return lines.join("\n");
  }

  if ("summary" in data) {
    const s = data.summary;
    lines.push(`Relatório ${tab} - ${getPeriodLabel(period)}`);
    lines.push("");
    if (tab === "financeiro") {
      lines.push("Resumo");
      lines.push(`Receita Total,${s.totalIncome}`);
      lines.push(`Receita Recebida,${s.totalReceived}`);
      lines.push(`Receita Pendente,${s.totalPending}`);
      lines.push(`Despesas,${s.totalExpenses}`);
      lines.push(`Saldo,${s.balance}`);
      lines.push("");
    }
    lines.push("Data,Descrição,Tipo,Valor,Valor Recebido,Forma Pagamento,Categoria");
    data.transactions.forEach((t) => {
      lines.push(
        `${t.date},"${t.description}",${t.type === "receita" ? "Receita" : "Despesa"},${t.amount},${t.amount_received || 0},${methodLabels[t.payment_method || ""] || t.payment_method || ""},${categoryLabels[t.expense_category || ""] || t.expense_category || ""}`
      );
    });
  }

  return lines.join("\n");
}

// ─── XLSX ───────────────────────────────────────────────────
async function buildAndDownloadXLSX(tab: ReportTab, data: Awaited<ReturnType<typeof fetchReportData>>, fileName: string, _period: PeriodOption) {
  const mod = await import("write-excel-file");
  const writeXlsxFile = mod.default;
  type Cell = { value: string | number | null; type?: typeof String | typeof Number; fontWeight?: "bold" };
  type Row = Cell[];

  const sheets: { name: string; data: Row[] }[] = [];

  if (tab === "clientes" && "clients" in data) {
    const header: Row = [
      { value: "Nome", fontWeight: "bold" }, { value: "Status", fontWeight: "bold" },
      { value: "Plano", fontWeight: "bold" }, { value: "Telefone", fontWeight: "bold" },
      { value: "Valor do Plano", fontWeight: "bold" }, { value: "Status Pagamento", fontWeight: "bold" },
    ];
    const rows: Row[] = data.clients.map((c) => [
      { value: c.full_name, type: String }, { value: statusLabels[c.status] || c.status, type: String },
      { value: planLabels[c.plan] || c.plan, type: String }, { value: c.phone, type: String },
      { value: c.plan_value || 0, type: Number }, { value: paymentStatusLabels[c.payment_status] || c.payment_status, type: String },
    ]);
    sheets.push({ name: "Clientes", data: [header, ...rows] });
  } else if ("summary" in data) {
    if (tab === "financeiro") {
      const s = data.summary;
      const summaryHeader: Row = [{ value: "Métrica", fontWeight: "bold" }, { value: "Valor", fontWeight: "bold" }];
      const summaryRows: Row[] = [
        [{ value: "Receita Total", type: String }, { value: s.totalIncome, type: Number }],
        [{ value: "Receita Recebida", type: String }, { value: s.totalReceived, type: Number }],
        [{ value: "Receita Pendente", type: String }, { value: s.totalPending, type: Number }],
        [{ value: "Despesas", type: String }, { value: s.totalExpenses, type: Number }],
        [{ value: "Saldo", type: String }, { value: s.balance, type: Number }],
      ];
      sheets.push({ name: "Resumo", data: [summaryHeader, ...summaryRows] });
    }

    const txHeader: Row = [
      { value: "Data", fontWeight: "bold" }, { value: "Descrição", fontWeight: "bold" },
      { value: "Tipo", fontWeight: "bold" }, { value: "Valor", fontWeight: "bold" },
      { value: "Valor Recebido", fontWeight: "bold" }, { value: "Forma Pagamento", fontWeight: "bold" },
      { value: "Categoria", fontWeight: "bold" },
    ];
    const txRows: Row[] = data.transactions.map((t) => [
      { value: t.date, type: String }, { value: t.description, type: String },
      { value: t.type === "receita" ? "Receita" : "Despesa", type: String },
      { value: t.amount, type: Number }, { value: t.amount_received || 0, type: Number },
      { value: methodLabels[t.payment_method || ""] || t.payment_method || "", type: String },
      { value: categoryLabels[t.expense_category || ""] || t.expense_category || "", type: String },
    ]);
    sheets.push({ name: "Transações", data: [txHeader, ...txRows] });
  }

  if (sheets.length === 1) {
    await writeXlsxFile(sheets[0].data as any, { fileName: `${fileName}.xlsx` });
  } else if (sheets.length > 1) {
    await writeXlsxFile(sheets.map(s => s.data) as any, {
      sheets: sheets.map(s => s.name),
      fileName: `${fileName}.xlsx`,
    });
  }
}

// ─── PDF ────────────────────────────────────────────────────
async function buildAndDownloadPDF(tab: ReportTab, data: Awaited<ReturnType<typeof fetchReportData>>, fileName: string, period: PeriodOption) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  // jspdf-autotable adds autoTable to jsPDF prototype
  const autoTable = autoTableModule.default;

  const doc = new jsPDF();
  const title = `Relatório ${tab.charAt(0).toUpperCase() + tab.slice(1)} - ${getPeriodLabel(period)}`;
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 28);

  let startY = 35;

  if (tab === "clientes" && "clients" in data) {
    autoTable(doc, {
      startY,
      head: [["Nome", "Status", "Plano", "Telefone", "Valor", "Pgto"]],
      body: data.clients.map((c) => [
        c.full_name,
        statusLabels[c.status] || c.status,
        planLabels[c.plan] || c.plan,
        c.phone,
        formatCurrency(c.plan_value || 0),
        paymentStatusLabels[c.payment_status] || c.payment_status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [107, 33, 69] },
    });
  } else if ("summary" in data) {
    const s = data.summary;

    if (tab === "financeiro") {
      autoTable(doc, {
        startY,
        head: [["Métrica", "Valor"]],
        body: [
          ["Receita Total", formatCurrency(s.totalIncome)],
          ["Receita Recebida", formatCurrency(s.totalReceived)],
          ["Receita Pendente", formatCurrency(s.totalPending)],
          ["Despesas", formatCurrency(s.totalExpenses)],
          ["Saldo", formatCurrency(s.balance)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [107, 33, 69] },
      });
      startY = (doc as any).lastAutoTable?.finalY + 10 || startY + 50;
    }

    autoTable(doc, {
      startY,
      head: [["Data", "Descrição", "Tipo", "Valor", "Recebido", "Pagamento", "Categoria"]],
      body: data.transactions.map((t) => [
        t.date,
        t.description,
        t.type === "receita" ? "Receita" : "Despesa",
        formatCurrency(t.amount),
        formatCurrency(t.amount_received || 0),
        methodLabels[t.payment_method || ""] || t.payment_method || "",
        categoryLabels[t.expense_category || ""] || t.expense_category || "",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [107, 33, 69] },
    });
  }

  doc.save(`${fileName}.pdf`);
}

// ─── Trigger download ───────────────────────────────────────
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main export function ───────────────────────────────────
export async function exportReport(
  tab: ReportTab,
  period: PeriodOption,
  exportFormat: ExportFormat
): Promise<void> {
  const data = await fetchReportData(tab, period);
  const fileName = buildFileName(tab, period);

  switch (exportFormat) {
    case "csv":
      downloadCSV(buildCSV(tab, data, period), fileName);
      break;
    case "xlsx":
      await buildAndDownloadXLSX(tab, data, fileName, period);
      break;
    case "pdf":
      await buildAndDownloadPDF(tab, data, fileName, period);
      break;
  }
}
