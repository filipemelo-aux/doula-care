import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2, Receipt } from "lucide-react";
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

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

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

export function statusOf(r: ServiceRecord) {
  if (r.status === "forecast") return { label: "Previsto", variant: "secondary" as const };
  const t = r.transactions;
  if (t && Number(t.amount_received || 0) >= Number(t.amount || 0) && Number(t.amount) > 0)
    return { label: "Pago", variant: "default" as const };
  return { label: "Faturado", variant: "outline" as const };
}

export default function ServiceRecords() {
  const { organizationId, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: records = [], isLoading } = useServiceRecords();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    service_name: "",
    amount: "",
    service_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["service-records-clients", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("organization_id", organizationId!)
        .eq("is_visitor", false)
        .order("full_name");
      return data || [];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["custom-services-list", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_services")
        .select("id, name, icon")
        .eq("organization_id", organizationId!)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const amount = Number(String(form.amount).replace(/\./g, "").replace(",", ".")) || 0;
      if (!form.service_name.trim()) throw new Error("Informe o serviço");
      const { error } = await (supabase.from("service_records" as any) as any).insert({
        organization_id: organizationId,
        client_id: form.client_id || null,
        service_name: form.service_name.trim(),
        amount,
        service_date: form.service_date,
        notes: form.notes || null,
        status: "forecast",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-records"] });
      toast.success("Atendimento registrado! A previsão de recebimento foi criada.");
      setOpen(false);
      setForm({ client_id: "", service_name: "", amount: "", service_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("service_records" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-records"] });
      toast.success("Atendimento removido");
    },
  });

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Atendimentos</h1>
          <p className="page-description">Registre os serviços realizados. Cada um gera uma previsão de recebimento.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 w-full md:w-auto">
          <Plus className="w-4 h-4" /> Novo atendimento
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : records.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-foreground/70">Nenhum atendimento ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Registre o primeiro serviço realizado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">Serviço</th>
                  <th className="p-3 font-medium text-right">Valor</th>
                  <th className="p-3 font-medium">Situação</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const st = statusOf(r);
                  return (
                    <tr key={r.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3 whitespace-nowrap">{fmtDate(r.service_date)}</td>
                      <td className="p-3">{r.clients?.full_name || "—"}</td>
                      <td className="p-3">{r.service_name}</td>
                      <td className="p-3 text-right whitespace-nowrap">{brl(r.amount)}</td>
                      <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {r.status === "forecast" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate("/servicos/previsoes")}>
                              <Receipt className="w-4 h-4" /> Faturar
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="Remover">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => navigate("/financeiro")}>Ver fatura</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              {services.length > 0 ? (
                <div className="max-h-[11rem] overflow-y-auto p-0.5">
                  <div className="grid grid-cols-3 gap-2">
                    {services.map((s: any) => {
                      const sel = form.service_name === s.name;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setForm({ ...form, service_name: s.name })}
                          className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-center transition-all h-[4.5rem] ${sel ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/40 hover:bg-muted"}`}
                        >
                          <span className="text-base leading-none">{s.icon}</span>
                          <span className="text-[11px] font-medium truncate w-full leading-tight">{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum serviço cadastrado.{" "}
                  <button type="button" className="text-primary underline" onClick={() => navigate("/cadastros/servicos")}>Cadastrar serviços</button>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
