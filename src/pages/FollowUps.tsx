import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Search, Loader2, UserRound, Eye } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Acompanhamentos</h1>
          <p className="page-description">Acompanhamentos de doulagem. Cada um gera uma previsão de recebimento.</p>
        </div>
        <Button onClick={openPicker} className="gap-2 w-full md:w-auto">
          <Plus className="w-4 h-4" /> Novo acompanhamento
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        {active.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhum acompanhamento ainda.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {active.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getPlanName(c.plan_setting_id, c.plan)} · {brl(Number(c.plan_value || 0))}
                    {c.dpp ? ` · DPP ${formatBrazilDate(c.dpp)}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {c.status === "lactante" ? "Puérpera" : c.status === "gestante" ? "Gestante" : "Outro"}
                </Badge>
                <Button size="icon" variant="ghost" aria-label="Visualizar acompanhamento" onClick={() => setViewClient(c)}>
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Editar acompanhamento" onClick={() => setFollowClient(c)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
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
