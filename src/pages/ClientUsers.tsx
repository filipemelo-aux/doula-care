import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, UserPlus, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientAccessCard } from "@/components/settings/ClientAccessCard";
import { isValidUsername, sanitizeUsername, suggestPassword, suggestUsername } from "@/lib/clientAccess";

type Row = { id: string; full_name: string; dpp: string | null; user_id: string | null; first_login: boolean | null; status: string };

export default function ClientUsers() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Row | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ name: string; username: string; password: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["clients-with-accounts", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, dpp, user_id, first_login, status")
        .eq("organization_id", organizationId!)
        .eq("is_visitor", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const withAccess = useMemo(() => rows.filter((r) => r.user_id), [rows]);
  const withoutAccess = useMemo(() => rows.filter((r) => !r.user_id), [rows]);

  const openFor = (r: Row) => {
    setCreated(null);
    setSelected(r);
    setUsername(suggestUsername(r.full_name));
    setPassword(suggestPassword(r.dpp));
  };

  useEffect(() => {
    const id = params.get("cliente");
    if (!id || isLoading) return;
    const r = rows.find((x) => x.id === id);
    if (r && !r.user_id) openFor(r);
    else if (r?.user_id) toast.info(`${r.full_name} já possui acesso`);
    params.delete("cliente");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, isLoading, rows]);

  const create = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione a cliente");
      if (!isValidUsername(username)) throw new Error("Usuário inválido: letras sem acento, números, ponto ou traço (mín. 3)");
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres");
      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: { clientId: selected.id, fullName: selected.full_name, dpp: selected.dpp, username, password, organizationId },
      });
      if (data?.error) throw new Error(data.error);
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* noop */ }
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Acesso criado!");
      setCreated({ name: selected!.full_name, username, password });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["clients-with-accounts"] });
    },
    onError: (e: Error) => toast.error("Não foi possível criar o acesso", { description: e.message }),
  });

  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast.success(`${l} copiado!`); };

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="page-header mb-0">
        <h1 className="page-title">Usuários das clientes</h1>
        <p className="page-description">Crie e gerencie o acesso das suas clientes ao aplicativo.</p>
      </div>

      {selected && (
        <div className="rounded-2xl bg-card border border-primary/30 p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Novo acesso</p>
                <p className="text-sm font-semibold break-words">{selected.full_name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1.5">
            <Label>Usuário</Label>
            <Input value={username} onChange={(e) => setUsername(sanitizeUsername(e.target.value))} autoCapitalize="none" />
            <p className="text-[11px] text-muted-foreground">Sugerido a partir do nome (nome.sobrenome). Pode ajustar.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} autoCapitalize="none" />
            <p className="text-[11px] text-muted-foreground">
              {selected.dpp ? "Sugerida a partir da DPP (dpp + DDMMAA)." : "Cliente sem DPP: defina uma senha com pelo menos 6 caracteres."} A cliente poderá trocá-la no primeiro acesso.
            </p>
          </div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Criar acesso
          </Button>
        </div>
      )}

      {created && (
        <div className="rounded-2xl bg-success/10 p-4 space-y-2">
          <p className="text-sm font-semibold">Acesso de {created.name} criado</p>
          {[["Usuário", created.username], ["Senha", created.password]].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{l}</span>
              <span className="flex items-center gap-2 font-mono break-all">{v}
                <button onClick={() => copy(v, l)}><Copy className="h-3.5 w-3.5" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <h3 className="text-sm font-semibold mb-1">Clientes sem acesso</h3>
        <p className="text-xs text-muted-foreground mb-3">{withoutAccess.length} cliente(s)</p>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : withoutAccess.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Todas as clientes já têm acesso</p>
        ) : (
          <div className="space-y-1">
            {withoutAccess.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.full_name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{suggestUsername(r.full_name) || "—"}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 shrink-0" onClick={() => openFor(r)}>
                  <UserPlus className="h-3.5 w-3.5" /> Criar acesso
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ClientAccessCard clientsWithAccounts={withAccess} loadingClients={isLoading} />
    </div>
  );
}
