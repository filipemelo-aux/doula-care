import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, CheckCircle2, Trash2, Plus, Pencil, Search, Loader2, UserRound, Eye, Stethoscope, WalletCards, UsersRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanNames } from "@/hooks/usePlanNames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ServiceFlow, type ServiceStage } from "@/components/services/ServiceFlow";
import { formatBrazilDate } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export default function FollowUps() {
  const { organizationId } = useAuth();
  const { getPlanName } = usePlanNames();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [personOpen, setPersonOpen] = useState(false);
  const [followClient, setFollowClient] = useState<Tables<"clients"> | null>(null);
  const [viewClient, setViewClient] = useState<Tables<"clients"> | null>(null);
  const [sessionsClient, setSessionsClient] = useState<Tables<"clients"> | null>(null);
  const [sessionDates, setSessionDates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchList, setSearchList] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "gestante" | "lactante">("all");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", "followups", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("is_visitor", false)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ["followup-service-progress", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("service_records" as any) as any)
        .select("client_id, status, transactions(amount, amount_received)")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return (data || []) as Array<{
        client_id: string | null;
        status: "forecast" | "invoiced";
        transactions?: { amount: number; amount_received: number | null } | null;
      }>;
    },
  });

  const { data: planSettings = [] } = useQuery({
    queryKey: ["followup-plan-features", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_settings").select("id, plan_type, features").eq("organization_id", organizationId!);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["followup-sessions", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("followup_sessions" as any) as any)
        .select("id, client_id, service_name, performed_at, notes")
        .eq("organization_id", organizationId)
        .order("performed_at");
      if (error) throw error;
      return (data || []) as Array<{ id: string; client_id: string; service_name: string; performed_at: string; notes: string | null }>;
    },
  });

  const includedFor = (c: Tables<"clients">): string[] => {
    const plan = planSettings.find((p) => p.id === c.plan_setting_id) || planSettings.find((p) => !c.plan_setting_id && p.plan_type === c.plan);
    return (plan?.features || []).map((f) => f.trim()).filter(Boolean);
  };
  const sessionsFor = (clientId: string) => sessions.filter((s) => s.client_id === clientId);
  const sessionCount = (c: Tables<"clients">) => {
    const items = includedFor(c);
    const done = sessionsFor(c.id).filter((s) => items.includes(s.service_name)).length;
    return { done, total: items.length };
  };

  const registerSession = async (serviceName: string) => {
    if (!sessionsClient || !organizationId) return;
    const date = sessionDates[serviceName] || new Date().toISOString().slice(0, 10);
    const { error } = await (supabase.from("followup_sessions" as any) as any).insert({ organization_id: organizationId, client_id: sessionsClient.id, service_name: serviceName, performed_at: date });
    if (error) return toast.error("Não foi possível registrar");
    toast.success("Consulta registrada");
    refetchSessions();
  };
  const undoSession = async (id: string) => {
    const { error } = await (supabase.from("followup_sessions" as any) as any).delete().eq("id", id);
    if (error) return toast.error("Não foi possível desfazer");
    refetchSessions();
  };

  // Busca no banco ao digitar (autocomplete de cliente)
  const { data: suggestions = [], isFetching: searching } = useQuery({
    queryKey: ["clients", "followup-search", organizationId, debounced],
    enabled: !!organizationId && pickerOpen && debounced.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, status, dpp")
        .eq("organization_id", organizationId!)
        .eq("is_visitor", false)
        .ilike("full_name", `%${debounced}%`)
        .order("full_name")
        .limit(8);
      if (error) throw error;
      return data as Pick<Tables<"clients">, "id" | "full_name" | "status" | "dpp">[];
    },
  });

  const active = clients.filter((c) => c.plan_setting_id || Number(c.plan_value || 0) > 0 || c.plan === "avulso");
  const visibleActive = useMemo(() => active.filter((c) => {
    const matchesSearch = !searchList.trim() || c.full_name.toLowerCase().includes(searchList.toLowerCase()) || getPlanName(c.plan_setting_id, c.plan).toLowerCase().includes(searchList.toLowerCase());
    return matchesSearch && (statusFilter === "all" || c.status === statusFilter);
  }), [active, searchList, statusFilter, getPlanName]);
  const contractedTotal = active.reduce((sum, client) => sum + Number(client.plan_value || 0), 0);
  const gestantes = active.filter((client) => client.status === "gestante").length;
  const puerperas = active.filter((client) => client.status === "lactante").length;
  const metrics: Array<{ label: string; value: string | number; icon: LucideIcon }> = [
    { label: "Ativos", value: active.length, icon: UsersRound },
    { label: "Valor contratado", value: brl(contractedTotal), icon: WalletCards },
    { label: "Gestantes", value: gestantes, icon: Stethoscope },
    { label: "Puérperas", value: puerperas, icon: UserRound },
  ];
  const activeIds = new Set(active.map((c) => c.id));
  // Sugestões excluem clientes que já possuem acompanhamento registrado
  const visibleSuggestions = suggestions.filter((s) => !activeIds.has(s.id));

  const picked = clients.find((c) => c.id === pickedId);
  const pickedHasFollowUp = !!picked && activeIds.has(picked.id);

  const progressFor = (c: Tables<"clients">): { stage: ServiceStage; description: string } => {
    const clientId = c.id;
    const records = serviceRecords.filter((record) => record.client_id === clientId);
    if (records.length === 0) {
      const { done, total } = sessionCount(c);
      if (done > 0) return { stage: "performed", description: `${done} de ${total} consulta(s) do plano realizada(s)${done >= total ? " · todas concluídas" : ""}` };
      return { stage: "contract", description: total ? `Acompanhamento contratado · ${total} consulta(s) inclusa(s) no plano aguardando registro` : "Acompanhamento contratado · aguardando o primeiro atendimento" };
    }
    if (records.some((record) => record.status === "forecast")) return { stage: "forecast", description: "Atendimento registrado · aguardando a geração da fatura" };
    const hasOpenInvoice = records.some((record) => {
      const transaction = record.transactions;
      return !transaction || Number(transaction.amount_received || 0) < Number(transaction.amount || 0);
    });
    if (hasOpenInvoice) return { stage: "invoiced", description: "Fatura gerada · aguardando o recebimento" };
    return { stage: "paid", description: "Todos os atendimentos faturados foram pagos" };
  };

  const startFollowUp = () => {
    const c = clients.find((x) => x.id === pickedId);
    if (!c) return;
    if (activeIds.has(c.id)) {
      toast.error("Esta cliente já possui um acompanhamento registrado.");
      return;
    }
    setPickerOpen(false);
    setFollowClient(c);
  };

  const openPicker = () => {
    setPickedId("");
    setSearch("");
    setDebounced("");
    setShowSuggestions(false);
    setPickerOpen(true);
  };

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase text-primary">Central de Serviços</p>
          <h1 className="page-title">Acompanhamentos</h1>
          <p className="page-description">Contratos de doulagem, valores combinados e andamento de cada cliente.</p>
        </div>
        <Button onClick={openPicker} className="gap-2 w-full md:w-auto">
          <Plus className="w-4 h-4" /> Novo acompanhamento
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-card p-3 shadow-card lg:p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <p className="text-lg font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchList} onChange={(event) => setSearchList(event.target.value)} placeholder="Buscar cliente ou plano" className="pl-9" /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { value: "all", label: "Todos", count: active.length },
            { value: "gestante", label: "Gestantes", count: gestantes },
            { value: "lactante", label: "Puérperas", count: puerperas },
          ].map((item) => <Button key={item.value} size="sm" variant={statusFilter === item.value ? "default" : "secondary"} onClick={() => setStatusFilter(item.value as typeof statusFilter)} className="shrink-0">{item.label} <span className="ml-1 opacity-70">{item.count}</span></Button>)}
        </div>
      </div>

      <div>
        {active.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center shadow-card"><p className="font-semibold">Nenhum acompanhamento ativo</p><p className="mt-1 text-sm text-muted-foreground">Crie o primeiro contrato de acompanhamento para iniciar o fluxo.</p><Button onClick={openPicker} className="mt-4">Novo acompanhamento</Button></div>
        ) : visibleActive.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card"><p className="font-semibold">Nenhum acompanhamento neste filtro</p><p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou escolha outra situação.</p></div>
        ) : (
          <div className="space-y-3">
            {visibleActive.map((c) => {
              const progress = progressFor(c);
              const count = sessionCount(c);
              return (
              <article key={c.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{c.full_name}</p><p className="truncate text-xs text-muted-foreground">{getPlanName(c.plan_setting_id, c.plan)}{c.dpp ? ` · DPP ${formatBrazilDate(c.dpp)}` : ""}</p></div><Badge variant="secondary">{c.status === "lactante" ? "Puérpera" : c.status === "gestante" ? "Gestante" : "Outro"}</Badge></div><p className="mt-2 font-bold">{brl(Number(c.plan_value || 0))}</p></div>
                </div>
                <div className="border-t border-border/30 px-4 py-3">
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-foreground">Andamento do acompanhamento</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{progress.description}</p>
                  </div>
                  <ServiceFlow current={progress.stage} />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/30 p-3">
                  <Button variant="default" size="sm" onClick={() => setSessionsClient(c)}><ListChecks className="mr-1.5 h-4 w-4" /> Consultas{count.total ? ` ${count.done}/${count.total}` : ""}</Button>
                  <Button variant="secondary" size="sm" onClick={() => setViewClient(c)}><Eye className="mr-2 h-4 w-4" /> Visualizar</Button>
                  <Button variant="secondary" size="sm" onClick={() => setFollowClient(c)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!sessionsClient} onOpenChange={(o) => { if (!o) setSessionsClient(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Consultas do plano</DialogTitle></DialogHeader>
          {sessionsClient && (() => {
            const items = includedFor(sessionsClient);
            const done = sessionsFor(sessionsClient.id);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{sessionsClient.full_name} · {getPlanName(sessionsClient.plan_setting_id, sessionsClient.plan)}</p>
                {items.length === 0 ? (
                  <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Este plano não tem serviços inclusos cadastrados. Adicione-os em Configurações → Planos (um serviço por linha).</div>
                ) : items.map((item) => {
                  const record = done.find((d) => d.service_name === item);
                  return (
                    <div key={item} className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-start gap-2">
                        {record ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                        <p className="flex-1 text-sm font-medium">{item}</p>
                      </div>
                      {record ? (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Realizada em {formatBrazilDate(record.performed_at)}</span>
                          <Button size="sm" variant="ghost" onClick={() => undoSession(record.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <Input type="date" className="h-9" value={sessionDates[item] || new Date().toISOString().slice(0, 10)} onChange={(e) => setSessionDates((d) => ({ ...d, [item]: e.target.value }))} />
                          <Button size="sm" onClick={() => registerSession(item)}>Registrar</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">Cada consulta registrada avança a linha do tempo do acompanhamento.</p>
              </div>
            );
          })()}
          <DialogFooter><Button variant="secondary" onClick={() => setSessionsClient(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo acompanhamento</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <div className="flex items-start gap-2">
              <div ref={boxRef} className="relative flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={picked ? picked.full_name : search}
                    onChange={(e) => { setSearch(e.target.value); setPickedId(""); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Digite o nome da cliente…"
                    className="pl-9"
                    autoComplete="off"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                </div>
                {showSuggestions && debounced.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-md overflow-hidden">
                    {visibleSuggestions.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        {suggestions.length === 0
                          ? "Nenhuma cliente encontrada"
                          : "Nenhuma cliente nova encontrada — as clientes listadas já possuem acompanhamento"}
                      </p>
                    ) : (
                      <ul className="max-h-56 overflow-y-auto py-1">
                        {visibleSuggestions.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                              onClick={() => {
                                setPickedId(s.id);
                                setSearch("");
                                setDebounced("");
                                setShowSuggestions(false);
                              }}
                            >
                              <UserRound className="w-4 h-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 min-w-0 truncate">{s.full_name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {s.status === "lactante" ? "Puérpera" : s.status === "gestante" ? "Gestante" : "Outro"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                aria-label="Cadastrar nova pessoa"
                title="Cadastrar nova pessoa"
                onClick={() => setPersonOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {picked && (
              <div className="text-xs pt-0.5 space-y-0.5">
                {pickedHasFollowUp ? (
                  <p className="text-destructive font-medium">
                    Esta cliente já possui um acompanhamento registrado.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Selecionada: <span className="font-medium text-foreground">{picked.full_name}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancelar</Button>
            <Button onClick={startFollowUp} disabled={!pickedId || pickedHasFollowUp}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientDialog
        open={personOpen}
        onOpenChange={setPersonOpen}
        mode="person"
        onSaved={async (id) => { await refetch(); setPickedId(id); }}
      />

      <ClientDialog
        key={followClient?.id || "none"}
        open={!!followClient}
        onOpenChange={(o) => { if (!o) { setFollowClient(null); refetch(); } }}
        client={followClient}
        mode="followup"
      />

      <ClientDialog
        key={`view-${viewClient?.id || "none"}`}
        open={!!viewClient}
        onOpenChange={(o) => { if (!o) setViewClient(null); }}
        client={viewClient}
        mode="followup"
        readOnly
      />
    </div>
  );
}
