import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Eye, FileText, MoreVertical, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ServiceFlow, ServiceWorkspaceNav, type ServiceStage } from "@/components/services/ServiceFlow";

export interface ServiceRecord {
  id: string;
  client_id: string | null;
  service_date: string;
  service_name: string;
  amount: number;
  notes: string | null;
  status: "forecast" | "invoiced";
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

export function stageOf(r: ServiceRecord): ServiceStage {
  if (r.status === "forecast") return "forecast";
  const t = r.transactions;
  if (t && Number(t.amount_received || 0) >= Number(t.amount || 0) && Number(t.amount) > 0) return "paid";
  return "invoiced";
}

export function statusOf(r: ServiceRecord) {
  const stage = stageOf(r);
  if (stage === "forecast") return { label: "A faturar", variant: "secondary" as const };
  if (stage === "paid") return { label: "Pago", variant: "default" as const };
  return { label: "Faturado", variant: "outline" as const };
}

type Filter = "all" | "forecast" | "invoiced" | "paid";

export default function ServiceRecords() {
  const { organizationId, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: records = [], isLoading } = useServiceRecords();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState({ client_id: "", service_name: "", amount: "", service_date: format(new Date(), "yyyy-MM-dd"), notes: "" });

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
    const matchesText = !term || r.service_name.toLowerCase().includes(term) || r.clients?.full_name?.toLowerCase().includes(term);
    const stage = stageOf(r);
    return matchesText && (filter === "all" || stage === filter);
  }), [records, search, filter]);
  const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const toInvoice = records.filter((r) => stageOf(r) === "forecast");
  const paid = records.filter((r) => stageOf(r) === "paid");

  const create = useMutation({
    mutationFn: async () => {
      const amount = Number(String(form.amount).replace(/\./g, "").replace(",", ".")) || 0;
      if (!form.service_name.trim()) throw new Error("Informe o serviço");
      const { error } = await (supabase.from("service_records" as any) as any).insert({ organization_id: organizationId, client_id: form.client_id || null, service_name: form.service_name.trim(), amount, service_date: form.service_date, notes: form.notes || null, status: "forecast", created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-records"] });
      toast.success("Atendimento registrado e enviado para A faturar.");
      setOpen(false);
      setForm({ client_id: "", service_name: "", amount: "", service_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.from("service_records" as any) as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-records"] }); toast.success("Atendimento removido"); },
  });

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: records.length },
    { value: "forecast", label: "A faturar", count: toInvoice.length },
    { value: "invoiced", label: "Faturados", count: records.filter((r) => stageOf(r) === "invoiced").length },
    { value: "paid", label: "Pagos", count: paid.length },
  ];

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="page-header mb-0 min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase text-primary">Central de Serviços</p>
          <h1 className="page-title">Atendimentos</h1>
          <p className="page-description">Serviços realizados e o caminho de cada um até o pagamento.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full gap-2 md:w-auto"><Plus className="h-4 w-4" /> Novo atendimento</Button>
      </div>

      <ServiceWorkspaceNav active="records" onNavigate={navigate} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Realizados", records.length, CalendarDays], ["Valor dos serviços", brl(total), FileText],
          ["A faturar", toInvoice.length, Receipt], ["Pagos", paid.length, Eye],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl bg-card p-3 shadow-card lg:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <p className="text-lg font-bold text-foreground">{value as any}</p><p className="text-xs text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou serviço" className="pl-9" /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((item) => <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "secondary"} onClick={() => setFilter(item.value)} className="shrink-0">{item.label} <span className="ml-1 opacity-70">{item.count}</span></Button>)}
        </div>
      </div>

      {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando atendimentos...</p> : filtered.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center shadow-card">
          <p className="font-semibold">{records.length ? "Nenhum atendimento neste filtro" : "Nenhum serviço realizado"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{records.length ? "Escolha outra situação ou ajuste a busca." : "Registre o primeiro atendimento para iniciar o fluxo."}</p>
          {!records.length && <Button onClick={() => setOpen(true)} className="mt-4">Registrar atendimento</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const st = statusOf(r); const stage = stageOf(r);
            return <article key={r.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">{services.find((s: any) => s.name === r.service_name)?.icon || "✦"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{r.service_name}</p><p className="truncate text-xs text-muted-foreground">{r.clients?.full_name || "Sem cliente"} · {fmtDate(r.service_date)}</p></div><Badge variant={st.variant}>{st.label}</Badge></div>
                  <p className="mt-2 font-bold">{brl(r.amount)}</p>
                </div>
                <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações do atendimento"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetail(r)}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(r.status === "forecast" ? "/servicos/previsoes" : "/financeiro")}>{r.status === "forecast" ? <Receipt className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}{r.status === "forecast" ? "Faturar" : "Ver fatura"}</DropdownMenuItem>
                  {r.status === "forecast" && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="mr-2 h-4 w-4" /> Remover</DropdownMenuItem></>}
                </DropdownMenuContent></DropdownMenu>
              </div>
              <div className="border-t border-border/30 px-4 py-3"><ServiceFlow current={stage} compact /></div>
            </article>;
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(value) => !value && setDetail(null)}><DialogContent><DialogHeader><DialogTitle>Detalhes do atendimento</DialogTitle></DialogHeader>{detail && <div className="space-y-5"><div><p className="text-xs text-muted-foreground">Serviço</p><p className="font-semibold">{detail.service_name}</p><p className="text-sm text-muted-foreground">{detail.clients?.full_name || "Sem cliente"} · {fmtDate(detail.service_date)}</p></div><ServiceFlow current={stageOf(detail)} /><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3"><div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold">{brl(detail.amount)}</p></div><div><p className="text-xs text-muted-foreground">Situação</p><p className="font-semibold">{statusOf(detail).label}</p></div></div>{detail.notes && <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{detail.notes}</p></div>}<Button className="w-full" variant="secondary" onClick={() => setDetail(null)}>Fechar</Button></div>}</DialogContent></Dialog>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader><div className="space-y-4">
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-sm font-semibold">1. Serviço realizado</p><p className="text-xs text-muted-foreground">Informe o que foi feito e para qual cliente.</p></div>
        <div className="space-y-1.5"><Label>Cliente</Label><Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}><SelectTrigger><SelectValue placeholder="Selecione a cliente" /></SelectTrigger><SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Serviço</Label>{services.length > 0 ? <div className="max-h-44 overflow-y-auto"><div className="grid grid-cols-3 gap-2">{services.map((s: any) => { const selected = form.service_name === s.name; return <Button key={s.id} type="button" variant={selected ? "default" : "secondary"} onClick={() => setForm({ ...form, service_name: s.name })} className="h-[4.75rem] min-w-0 flex-col gap-1 px-2"><span className="text-base">{s.icon}</span><span className="w-full truncate text-[11px]">{s.name}</span></Button>; })}</div></div> : <Button type="button" variant="secondary" onClick={() => navigate("/cadastros/servicos")}>Cadastrar serviços</Button>}</div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></div><div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div></div>
        <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">Ao registrar, este atendimento aparecerá em <strong className="text-foreground">A faturar</strong>.</div>
      </div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => create.mutate()} disabled={create.isPending}>Registrar atendimento</Button></DialogFooter></Dialog>
    </div>
  );
}