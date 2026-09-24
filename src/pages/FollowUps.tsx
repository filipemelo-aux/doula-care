import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ListChecks, CheckCircle2, Trash2, Plus, Pencil, Search, Loader2, UserRound, Eye, Stethoscope, WalletCards, UsersRound, type LucideIcon } from "lucide-react";
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
import { ConsultationTimeline } from "@/components/services/ConsultationTimeline";
import { buildSteps, sessionsDb, useFollowupSessions, usePlanConsultations, type ConsultationStep } from "@/lib/consultations";
import { ensureAvailabilityForAppointment } from "@/lib/ensureAvailability";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { useNavigate } from "react-router-dom";
import { formatBrazilDate } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export default function FollowUps() {
  const { organizationId, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
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

  const { data: planItems = [] } = usePlanConsultations(organizationId);
  const { data: sessions = [], refetch: refetchSessions } = useFollowupSessions(organizationId);
  const [scheduleFor, setScheduleFor] = useState<{ seq: number; label: string } | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [busy, setBusy] = useState(false);

  const stepsFor = (c: Tables<"clients">) => buildSteps(c.plan_setting_id, planItems, sessions.filter((s) => s.client_id === c.id));

  const afterChange = () => { refetchSessions(); qc.invalidateQueries({ queryKey: ["agenda-appointments"] }); qc.invalidateQueries({ queryKey: ["all-appointments"] }); };

  const markDone = async (c: Tables<"clients">, step: ConsultationStep) => {
    const date = sessionDates[step.label] || new Date().toISOString().slice(0, 10);
    setBusy(true);
    try {
      if (step.session?.appointment_id) {
        const { error } = await supabase.from("appointments").update({ completed_at: new Date().toISOString() }).eq("id", step.session.appointment_id);
        if (error) throw error;
      } else if (step.session) {
        const { error } = await sessionsDb().update({ status: "done", performed_at: date }).eq("id", step.session.id);
        if (error) throw error;
      } else {
        const { error } = await sessionsDb().insert({ organization_id: organizationId, client_id: c.id, service_name: step.label, sequence: step.sequence, status: "done", performed_at: date, created_by: user?.id });
        if (error) throw error;
      }
      toast.success(`Consulta ${step.sequence} registrada como realizada`);
      afterChange();
    } catch { toast.error("Não foi possível registrar"); } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!sessionsClient || !scheduleFor || !schedDate || !organizationId) return;
    setBusy(true);
    try {
      const scheduledUtc = fromZonedTime(`${schedDate}T${schedTime}`, "America/Sao_Paulo").toISOString();
      const { data: apt, error } = await supabase.from("appointments").insert({ client_id: sessionsClient.id, title: `Consulta ${scheduleFor.seq} · ${scheduleFor.label}`, scheduled_at: scheduledUtc, owner_id: user?.id || null, organization_id: organizationId } as any).select("id").single();
      if (error) throw error;
      const { error: e2 } = await sessionsDb().insert({ organization_id: organizationId, client_id: sessionsClient.id, service_name: scheduleFor.label, sequence: scheduleFor.seq, status: "scheduled", appointment_id: apt.id, created_by: user?.id });
      if (e2) throw e2;
      await ensureAvailabilityForAppointment(organizationId, scheduledUtc);
      toast.success("Consulta agendada e adicionada à agenda");
      setScheduleFor(null);
      afterChange();
    } catch { toast.error("Não foi possível agendar"); } finally { setBusy(false); }
  };

  const cancelSchedule = async (step: ConsultationStep) => {
    if (!step.session) return;
    setBusy(true);
    const { error } = step.session.appointment_id
      ? await supabase.from("appointments").delete().eq("id", step.session.appointment_id)
      : await sessionsDb().delete().eq("id", step.session.id);
    setBusy(false);
    if (error) return toast.error("Não foi possível cancelar");
    toast.success("Agendamento cancelado");
    afterChange();
  };

  const undoDone = async (step: ConsultationStep) => {
    if (!step.session) return;
    setBusy(true);
    const { error } = step.session.appointment_id
      ? await supabase.from("appointments").update({ completed_at: null, completion_notes: null }).eq("id", step.session.appointment_id)
      : await sessionsDb().delete().eq("id", step.session.id);
    setBusy(false);
    if (error) return toast.error("Não foi possível desfazer");
    afterChange();
  };

  const fmtDateTime = (iso: string) => formatInTimeZone(new Date(iso), "America/Sao_Paulo", "dd/MM 'às' HH:mm");

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
              const steps = stepsFor(c);
              const done = steps.filter((st) => st.state === "done").length;
              const next = steps.find((st) => st.state !== "done");
              return (
              <article key={c.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{c.full_name}</p><p className="truncate text-xs text-muted-foreground">{getPlanName(c.plan_setting_id, c.plan)}{c.dpp ? ` · DPP ${formatBrazilDate(c.dpp)}` : ""}</p></div><Badge variant="secondary">{c.status === "lactante" ? "Puérpera" : c.status === "gestante" ? "Gestante" : "Outro"}</Badge></div><p className="mt-2 font-bold">{brl(Number(c.plan_value || 0))}</p></div>
                </div>
                <div className="border-t border-border/30 px-4 py-3">
                  {steps.length === 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Este plano ainda não tem roteiro de consultas.</p>
                      <Button size="sm" variant="ghost" onClick={() => navigate("/configuracoes", { state: { tab: "planos" } })}>Definir consultas</Button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">Consultas</p>
                        <p className="text-xs text-muted-foreground">{done} de {steps.length} realizadas</p>
                      </div>
                      <ConsultationTimeline steps={steps} />
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {next ? <>Próxima: <span className="font-medium text-foreground">{next.label}</span>{next.state === "scheduled" && next.session?.appointments?.scheduled_at ? ` · agendada ${fmtDateTime(next.session.appointments.scheduled_at)}` : " · sem data"}</> : "Todas as consultas do plano foram realizadas"}
                      </p>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/30 p-3">
                  <Button variant="default" size="sm" onClick={() => setSessionsClient(c)}><ListChecks className="mr-1.5 h-4 w-4" /> Consultas{steps.length ? ` ${done}/${steps.length}` : ""}</Button>
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
            const steps = stepsFor(sessionsClient);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{sessionsClient.full_name} · {getPlanName(sessionsClient.plan_setting_id, sessionsClient.plan)}</p>
                {steps.length > 0 && <ConsultationTimeline steps={steps} />}
                {steps.length === 0 ? (
                  <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Este plano não tem roteiro de consultas. Defina em Configurações → Planos → Roteiro de consultas.</div>
                ) : steps.map((step) => (
                  <div key={step.sequence} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-primary">{step.sequence}.</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {step.modality === "online" ? "Online" : "Presencial"} · {step.state === "done" ? `Realizada${step.session?.performed_at ? ` em ${formatBrazilDate(step.session.performed_at)}` : ""}` : step.state === "scheduled" ? `Agendada${step.session?.appointments?.scheduled_at ? ` ${fmtDateTime(step.session.appointments.scheduled_at)}` : ""}` : "Pendente"}
                        </p>
                      </div>
                      {step.state === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                    </div>
                    {step.state === "done" && step.session?.notes && <p className="mt-2 rounded-lg bg-card p-2 text-xs">{step.session.notes}</p>}
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {step.state === "pending" && (scheduleFor?.seq === step.sequence ? (
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <Input type="date" className="h-9 flex-1" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
                          <Input type="time" className="h-9 w-28" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                          <Button size="sm" variant="ghost" onClick={() => setScheduleFor(null)}>Voltar</Button>
                          <Button size="sm" onClick={schedule} disabled={busy || !schedDate}>Confirmar</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => markDone(sessionsClient, step)}>Registrar como realizada</Button>
                          <Button size="sm" disabled={busy} onClick={() => { setScheduleFor({ seq: step.sequence, label: step.label }); setSchedDate(new Date().toISOString().slice(0, 10)); }}><CalendarPlus className="mr-1.5 h-4 w-4" /> Agendar</Button>
                        </>
                      ))}
                      {step.state === "scheduled" && (
                        <>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => cancelSchedule(step)}>Cancelar agendamento</Button>
                          <Button size="sm" variant="secondary" onClick={() => navigate("/agenda")}>Reagendar</Button>
                          <Button size="sm" disabled={busy} onClick={() => markDone(sessionsClient, step)}>Concluir</Button>
                        </>
                      )}
                      {step.state === "done" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => undoDone(step)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Consultas agendadas aparecem na Agenda. Ao concluir lá, elas são marcadas aqui automaticamente.</p>
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
