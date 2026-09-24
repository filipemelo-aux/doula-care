import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Search, Loader2, UserRound, Eye, MoreVertical, Stethoscope, WalletCards, UsersRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanNames } from "@/hooks/usePlanNames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ServiceFlow, ServiceWorkspaceNav } from "@/components/services/ServiceFlow";
import { formatBrazilDate } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export default function FollowUps() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { getPlanName } = usePlanNames();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [personOpen, setPersonOpen] = useState(false);
  const [followClient, setFollowClient] = useState<Tables<"clients"> | null>(null);
  const [viewClient, setViewClient] = useState<Tables<"clients"> | null>(null);
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

      <ServiceWorkspaceNav active="followups" onNavigate={navigate} />

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
            {visibleActive.map((c) => (
              <article key={c.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{c.full_name}</p><p className="truncate text-xs text-muted-foreground">{getPlanName(c.plan_setting_id, c.plan)}{c.dpp ? ` · DPP ${formatBrazilDate(c.dpp)}` : ""}</p></div><Badge variant="secondary">{c.status === "lactante" ? "Puérpera" : c.status === "gestante" ? "Gestante" : "Outro"}</Badge></div><p className="mt-2 font-bold">{brl(Number(c.plan_value || 0))}</p></div>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações do acompanhamento"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setViewClient(c)}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem><DropdownMenuItem onClick={() => setFollowClient(c)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem><DropdownMenuItem onClick={() => navigate("/servicos/atendimentos", { state: { clientId: c.id, clientName: c.full_name } })}><Plus className="mr-2 h-4 w-4" /> Registrar atendimento</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
                <div className="border-t border-border/30 px-4 py-3"><ServiceFlow current="contract" compact /></div>
              </article>
            ))}
          </div>
        )}
      </div>

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
