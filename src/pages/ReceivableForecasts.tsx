import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, FileText, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ServiceFlow, ServiceWorkspaceNav } from "@/components/services/ServiceFlow";
import { useServiceRecords, brl, fmtDate, type ServiceRecord } from "./ServiceRecords";

export default function ReceivableForecasts() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useServiceRecords();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const forecasts = data.filter((r) => r.status === "forecast");
  const visible = forecasts.filter((r) => !search.trim() || r.service_name.toLowerCase().includes(search.toLowerCase()) || r.clients?.full_name?.toLowerCase().includes(search.toLowerCase()));
  const selectedRecords = forecasts.filter((r) => selected.includes(r.id));
  const selectedClientId = selectedRecords[0]?.client_id;
  const total = forecasts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const selectedTotal = selectedRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; records: ServiceRecord[] }>();
    visible.forEach((record) => {
      const key = record.client_id || `none-${record.id}`;
      const current = map.get(key) || { name: record.clients?.full_name || "Sem cliente", records: [] };
      current.records.push(record); map.set(key, current);
    });
    return [...map.entries()];
  }, [visible]);

  const toggle = (record: ServiceRecord) => {
    if (selected.includes(record.id)) return setSelected((ids) => ids.filter((id) => id !== record.id));
    if (selectedClientId && selectedClientId !== record.client_id) return;
    setSelected((ids) => [...ids, record.id]);
  };
  const invoice = () => {
    if (!selectedRecords.length) return;
    navigate("/financeiro", { state: { invoiceFromRecords: selectedRecords.map((r) => ({ id: r.id, client_id: r.client_id, amount: r.amount, description: r.service_name, date: r.service_date, notes: r.notes })) } });
  };

  return <div className="space-y-4 lg:space-y-6 pb-28">
    <div className="page-header mb-0"><p className="mb-1 text-[10px] font-bold uppercase text-primary">Central de Serviços</p><h1 className="page-title">A faturar</h1><p className="page-description">Confira os serviços realizados antes de gerar a fatura.</p></div>
    <ServiceWorkspaceNav active="forecasts" onNavigate={navigate} />
    <div className="rounded-2xl bg-primary/10 p-4 shadow-card lg:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Valor aguardando faturamento</p><p className="text-3xl font-bold text-primary">{brl(total)}</p><p className="mt-1 text-xs text-muted-foreground">{forecasts.length} serviço(s) pronto(s) para faturar</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary"><CalendarClock className="h-5 w-5" /></div></div></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou serviço" className="pl-9" /></div>
    {selectedRecords.length > 0 && <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-xl bg-foreground p-3 text-background shadow-medium"><div><p className="text-xs opacity-70">{selectedRecords.length} selecionado(s)</p><p className="font-bold">{brl(selectedTotal)}</p></div><Button onClick={invoice} size="sm"><Receipt className="mr-1.5 h-4 w-4" /> Gerar fatura</Button></div>}
    {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando previsões...</p> : groups.length === 0 ? <div className="rounded-2xl bg-card p-10 text-center shadow-card"><FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Nada a faturar</p><p className="mt-1 text-sm text-muted-foreground">Quando um atendimento for registrado, ele aparecerá aqui.</p><Button className="mt-4" onClick={() => navigate("/servicos/atendimentos")}>Registrar atendimento</Button></div> : <div className="space-y-4">{groups.map(([key, group]) => <section key={key} className="overflow-hidden rounded-2xl bg-card shadow-card"><div className="flex items-center justify-between bg-muted/40 px-4 py-3"><div><p className="text-xs font-bold uppercase text-primary">Cliente</p><h2 className="font-semibold">{group.name}</h2></div><p className="font-bold">{brl(group.records.reduce((sum, r) => sum + Number(r.amount), 0))}</p></div><div className="divide-y divide-border/30">{group.records.map((r) => { const disabled = !!selectedClientId && selectedClientId !== r.client_id; return <label key={r.id} className={`flex items-start gap-3 p-4 ${disabled ? "opacity-40" : "cursor-pointer"}`}><Checkbox checked={selected.includes(r.id)} disabled={disabled} onCheckedChange={() => toggle(r)} aria-label={`Selecionar ${r.service_name}`} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><p className="font-medium">{r.service_name}</p><p className="text-xs text-muted-foreground">Realizado em {fmtDate(r.service_date)}</p></div><p className="shrink-0 font-semibold">{brl(r.amount)}</p></div><div className="mt-3"><ServiceFlow current="forecast" compact /></div></div></label>; })}</div><div className="border-t border-border/30 p-3"><Button variant="secondary" className="w-full" onClick={() => { setSelected(group.records.map((r) => r.id)); }}>Selecionar serviços desta cliente</Button></div></section>)}</div>}
    {selectedRecords.length > 0 && <p className="text-center text-xs text-muted-foreground">Para evitar cobranças misturadas, cada fatura reúne serviços de uma única cliente.</p>}
  </div>;
}