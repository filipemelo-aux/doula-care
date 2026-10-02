import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Eye, FileText, HandCoins, Plus, Search, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createServiceRecordWithReceivable } from "@/lib/serviceBilling";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { fromZonedTime } from "date-fns-tz";

export interface ServiceRecord {
  id: string;
  client_id: string | null;
  service_date: string;
  service_name: string;
  amount: number;
  notes: string | null;
  status: "forecast" | "invoiced"; // Valor legado do banco; não há mais etapa de previsão no aplicativo.
  transaction_id: string | null;
  clients?: { full_name: string } | null;
  transactions?: { amount: number; amount_received: number | null } | null;
}

export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
export const fmtDate = (d: string) => format(new Date(d + "T12:00:00"), "dd/MM/yyyy");

export function useServiceRecords() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["service-records", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("service_records" as any) as any)
        .select("*, clients(full_name), transactions(amount, amount_received)")
        .eq("organization_id", organizationId)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data || []) as ServiceRecord[];
    },
  });
}

export function stageOf(r: ServiceRecord): "pending" | "partial" | "paid" {
  const t = r.transactions;
  if (t && Number(t.amount_received || 0) >= Number(t.amount || 0) && Number(t.amount) > 0) return "paid";
  if (t && Number(t.amount_received || 0) > 0) return "partial";
  return "pending";
}

export function statusOf(r: ServiceRecord) {
  const stage = stageOf(r);
  if (stage === "paid") return { label: "Pago", variant: "default" as const };
  if (stage === "partial") return { label: "Parcial", variant: "secondary" as const };
  return { label: "A receber", variant: "outline" as const };
}

export default function ServiceRecords() {
  const { organizationId, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [personOpen, setPersonOpen] = useState(false);
  const location = useLocation();
  const { data: records = [], isLoading } = useServiceRecords();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceRecord | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ client_id: "", service_name: "", amount: "", service_date: format(new Date(), "yyyy-MM-dd"), service_time: "09:00", notes: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedNames = form.service_name ? form.service_name.split(" + ") : [];
  const toggleService = (name: string) => {
    const next = selectedNames.includes(name) ? selectedNames.filter((n) => n !== name) : [...selectedNames, name];
    setForm((f) => ({ ...f, service_name: next.join(" + ") }));
  };
  const askConfirm = () => {
    const amount = Number(String(form.amount).replace(/\./g, "").replace(",", ".")) || 0;
    if (!selectedNames.length) return toast.error("Selecione ao menos um serviço");
    if (amount <= 0) return toast.error("Informe um valor maior que zero");
    if (!form.service_date) return toast.error("Informe a data de execução");
    setConfirmOpen(true);
  };

  useEffect(() => {
    const state = location.state as { clientId?: string } | null;
    if (!state?.clientId) return;
    setForm((current) => ({ ...current, client_id: state.clientId || "" }));
    setOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.state, navigate]);

  const { data: clients = [] } = useQuery({
    queryKey: ["service-records-clients", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").eq("organization_id", organizationId!).eq("is_visitor", false).order("full_name");
      return data || [];
    },
  });
  const { data: services = [] } = useQuery({
    queryKey: ["custom-services-list", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase.from("custom_services").select("id, name, icon").eq("organization_id", organizationId!).eq("is_active", true).order("name");
      return data || [];
    },
  });

  const filtered = useMemo(() => records.filter((r) => {
    const term = search.trim().toLowerCase();
    return !term || r.service_name.toLowerCase().includes(term) || r.clients?.full_name?.toLowerCase().includes(term);
  }), [records, search]);
  const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const metrics: Array<{ label: string; value: string | number; icon: LucideIcon }> = [
    { label: "Realizados", value: records.length, icon: CalendarDays },
    { label: "Valor dos serviços", value: brl(total), icon: FileText },
  ];

  const create = useMutation({
    mutationFn: async () => {
      const amount = Number(String(form.amount).replace(/\./g, "").replace(",", ".")) || 0;
      if (!form.service_name.trim()) throw new Error("Informe o serviço");
      if (amount <= 0) throw new Error("Informe um valor maior que zero para incluir o atendimento em Contas a Receber");
      await createServiceRecordWithReceivable({ organization_id: organizationId, client_id: form.client_id || null, service_name: form.service_name.trim(), amount, service_date: form.service_date, notes: form.notes || null, created_by: user?.id });
      const scheduledAt = fromZonedTime(`${form.service_date}T${form.service_time || "09:00"}`, "America/Sao_Paulo");
      const { error: aptErr } = await supabase.from("appointments").insert({ client_id: form.client_id || null, title: form.service_name.trim(), scheduled_at: scheduledAt.toISOString(), notes: form.notes || null, owner_id: user?.id || null, organization_id: organizationId } as any);
      if (aptErr) throw aptErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-records"] }); qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["agenda-appointments"] });
      qc.invalidateQueries({ queryKey: ["all-appointments"] });
      toast.success("Atendimento registrado, incluído na agenda e em Contas a Receber.");
      setOpen(false);
      setForm({ client_id: "", service_name: "", amount: "", service_date: format(new Date(), "yyyy-MM-dd"), service_time: "09:00", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="page-header mb-0 min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase text-primary">Central de Serviços</p>
          <h1 className="page-title">Atendimentos</h1>
          <p className="page-description">Serviços realizados. Os pagamentos são registrados em Contas a Receber.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full gap-2 md:w-auto"><Plus className="h-4 w-4" /> Novo atendimento</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-2xl bg-card p-3 shadow-card lg:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <p className="truncate text-lg font-bold text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou serviço" className="pl-9" /></div>
      </div>

      {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando atendimentos...</p> : filtered.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center shadow-card">
          <p className="font-semibold">{records.length ? "Nenhum atendimento encontrado" : "Nenhum serviço realizado"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{records.length ? "Ajuste a busca por cliente ou serviço." : "Registre o primeiro atendimento para iniciar o fluxo."}</p>
          {!records.length && <Button onClick={() => setOpen(true)} className="mt-4">Registrar atendimento</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const st = statusOf(r);
            return <article key={r.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">{services.find((s: any) => s.name === r.service_name)?.icon || "✦"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{r.service_name}</p><p className="truncate text-xs text-muted-foreground">{r.clients?.full_name || "Sem cliente"} · {fmtDate(r.service_date)}</p></div><Badge variant={st.variant}>{st.label}</Badge></div>
                  <p className="mt-2 font-bold">{brl(r.amount)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="Visualizar atendimento" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Registrar pagamento em Contas a Receber"
                    disabled={stageOf(r) === "paid"}
                    onClick={() => {
                      if (!r.transaction_id) { toast.error("Este atendimento não possui receita vinculada em Contas a Receber."); return; }
                      navigate("/financeiro", { state: { openPaymentTransactionId: r.transaction_id } });
                    }}
                  ><HandCoins className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>;
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(value) => !value && setDetail(null)}><DialogContent><DialogHeader><DialogTitle>Detalhes do atendimento</DialogTitle></DialogHeader>{detail && <div className="space-y-5"><div><p className="text-xs text-muted-foreground">Serviço</p><p className="font-semibold">{detail.service_name}</p><p className="text-sm text-muted-foreground">{detail.clients?.full_name || "Sem cliente"} · {fmtDate(detail.service_date)}</p></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3"><div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold">{brl(detail.amount)}</p></div><div><p className="text-xs text-muted-foreground">Situação</p><p className="font-semibold">{statusOf(detail).label}</p></div></div>{detail.notes && <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{detail.notes}</p></div>}<Button className="w-full" variant="secondary" onClick={() => setDetail(null)}>Fechar</Button></div>}</DialogContent></Dialog>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader><div className="space-y-4">
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-sm font-semibold">1. Serviço realizado</p><p className="text-xs text-muted-foreground">Informe o que foi feito e para qual cliente.</p></div>
        <div className="space-y-1.5"><Label>Cliente</Label><div className="flex items-center gap-2"><Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}><SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a cliente" /></SelectTrigger><SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select><Button type="button" size="icon" variant="secondary" aria-label="Cadastrar nova cliente" onClick={() => setPersonOpen(true)}><Plus className="h-4 w-4" /></Button></div></div>
        <div className="space-y-1.5"><div className="flex items-center gap-2"><Label>Serviço</Label><Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Cadastrar novo serviço" onClick={() => navigate("/cadastros/servicos")}><Plus className="h-3.5 w-3.5" /></Button></div>{services.length > 0 ? <div className="max-h-44 overflow-y-auto"><div className="grid grid-cols-3 gap-2">{services.map((s: any) => { const selected = selectedNames.includes(s.name); return <Button key={s.id} type="button" variant={selected ? "default" : "secondary"} onClick={() => toggleService(s.name)} className="h-[4.75rem] min-w-0 flex-col gap-1 px-2"><span className="text-base">{s.icon}</span><span className="w-full truncate text-[11px]">{s.name}</span></Button>; })}</div></div> : <Button type="button" variant="secondary" onClick={() => navigate("/cadastros/servicos")}>Cadastrar serviços</Button>}<p className="text-xs text-muted-foreground">Você pode selecionar mais de um serviço.</p>{selectedNames.length > 0 && <div className="rounded-xl bg-muted/50 p-3"><p className="mb-2 text-xs font-semibold">Selecionados ({selectedNames.length})</p><div className="flex flex-wrap gap-1.5">{selectedNames.map((n) => <Badge key={n} variant="secondary" className="gap-1 pr-1">{n}<button type="button" aria-label={`Remover ${n}`} onClick={() => toggleService(n)} className="rounded-full px-1 hover:bg-background">×</button></Badge>)}</div></div>}</div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></div><div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div></div>
        <div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={form.service_time} onChange={(e) => setForm({ ...form, service_time: e.target.value })} /><p className="text-xs text-muted-foreground">O atendimento entra automaticamente na agenda nesta data e horário.</p></div>
        <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">Ao registrar, este atendimento aparecerá em <strong className="text-foreground">Contas a Receber</strong>. O pagamento é registrado por lá.</div>
      </div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={askConfirm} disabled={create.isPending}>Registrar atendimento</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Confirmar atendimento</DialogTitle></DialogHeader><div className="space-y-3 text-sm"><div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-semibold">{clients.find((c: any) => c.id === form.client_id)?.full_name || "Sem cliente"}</p></div><div><p className="text-xs text-muted-foreground">Serviços</p><ul className="list-disc pl-5">{selectedNames.map((n) => <li key={n}>{n}</li>)}</ul></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3"><div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold">R$ {form.amount}</p></div><div><p className="text-xs text-muted-foreground">Execução</p><p className="font-semibold">{form.service_date ? form.service_date.split("-").reverse().join("/") : "-"} {form.service_time}</p></div></div><p className="text-xs text-muted-foreground">Será incluído na agenda e em Contas a Receber.</p></div><DialogFooter><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar</Button><Button disabled={create.isPending} onClick={() => { setConfirmOpen(false); create.mutate(); }}>Confirmar</Button></DialogFooter></DialogContent></Dialog>
      <ClientDialog open={personOpen} onOpenChange={setPersonOpen} mode="person-basic" onSaved={(id: string) => { qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["service-records-clients"] }); setForm((f) => ({ ...f, client_id: id })); }} />
    </div>
  );
}