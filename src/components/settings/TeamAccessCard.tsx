import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERMISSION_GROUPS, DEFAULT_TEAM_PATHS } from "@/lib/teamPermissions";

interface Member { user_id: string; full_name: string | null; roles: string[] }

export function TeamAccessCard({ members, locked }: { members: Member[]; locked: boolean }) {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const moderators = members.filter((m) => m.roles.includes("moderator") && !m.roles.includes("admin"));
  const [memberId, setMemberId] = useState("");
  const [paths, setPaths] = useState<string[]>(DEFAULT_TEAM_PATHS);
  const [dirty, setDirty] = useState(false);

  const { data: saved, isFetching } = useQuery({
    queryKey: ["team-permissions-admin", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data } = await (supabase.from("team_member_permissions" as any) as any)
        .select("allowed_paths").eq("user_id", memberId).maybeSingle();
      return (data?.allowed_paths as string[] | undefined) ?? DEFAULT_TEAM_PATHS;
    },
  });
  useEffect(() => { if (saved) { setPaths(saved); setDirty(false); } }, [saved]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("team_member_permissions" as any) as any)
        .upsert({ user_id: memberId, organization_id: organizationId, allowed_paths: paths }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acessos atualizados");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["team-permissions-admin", memberId] });
      qc.invalidateQueries({ queryKey: ["team-permissions"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar acessos", { description: e.message }),
  });

  const toggle = (to: string, on: boolean) => {
    setPaths((p) => (on ? [...new Set([...p, to])] : p.filter((x) => x !== to)));
    setDirty(true);
  };
  const toggleGroup = (items: { to: string }[], on: boolean) => {
    setPaths((p) => on ? [...new Set([...p, ...items.map((i) => i.to)])] : p.filter((x) => !items.some((i) => i.to === x)));
    setDirty(true);
  };

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {locked ? <Lock className="w-4 h-4 text-primary" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Configuração de acessos</h3>
          <p className="text-xs text-muted-foreground">Escolha a membro e ative o que ela pode ver. Visão Geral e Configurações ficam sempre liberadas.</p>
        </div>
      </div>

      {locked ? (
        <p className="text-xs text-muted-foreground">Disponível no plano Premium.</p>
      ) : moderators.length === 0 ? (
        <p className="text-xs text-muted-foreground">Cadastre uma membro da equipe (Moderador) para configurar os acessos.</p>
      ) : (
        <>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Selecione a membro da equipe" /></SelectTrigger>
            <SelectContent>
              {moderators.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Sem nome"}</SelectItem>)}
            </SelectContent>
          </Select>

          {memberId && !isFetching && (
            <div className="space-y-3">
              {PERMISSION_GROUPS.map((g) => {
                const allOn = g.items.every((i) => paths.includes(i.to));
                return (
                  <div key={g.label} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide">{g.label}</span>
                      <Switch checked={allOn} onCheckedChange={(v) => toggleGroup(g.items, v)} aria-label={`Ativar todo o menu ${g.label}`} />
                    </div>
                    <div className="space-y-2 border-t border-border/40 pt-2">
                      {g.items.map((i) => (
                        <label key={i.to} className="flex items-center justify-between gap-2 pl-2 text-sm">
                          <span className="min-w-0 truncate">{i.label}</span>
                          <Switch checked={paths.includes(i.to)} onCheckedChange={(v) => toggle(i.to, v)} />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <Button className="w-full" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Salvar acessos</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
