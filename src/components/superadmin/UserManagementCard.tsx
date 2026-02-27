import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Crown, Shield, User, Trash2, KeyRound, Search, Copy, Check } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  organization_id: string | null;
  org_name?: string;
  roles: string[];
}

export function UserManagementCard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["super-admin-all-users"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, organization_id")
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name");

      const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));

      return (profiles || []).map(p => ({
        ...p,
        roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
        org_name: p.organization_id ? orgMap.get(p.organization_id) || "—" : "—",
      })) as UserWithRole[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-users"] });
      setDeleteUserId(null);
      toast.success("Usuário excluído!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: { action: "reset-password", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, userId) => {
      setResetResult({ userId, password: data.newPassword });
      toast.success("Senha resetada com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopyPassword = () => {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.org_name?.toLowerCase().includes(q) ||
      u.roles.some(r => r.includes(q))
    );
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge key={role} className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0"><Crown className="w-2.5 h-2.5 mr-0.5" />Admin</Badge>;
      case "moderator":
        return <Badge key={role} className="bg-amber-500/15 text-amber-600 border-0 text-[10px] px-1.5 py-0"><Shield className="w-2.5 h-2.5 mr-0.5" />Mod</Badge>;
      case "super_admin":
        return <Badge key={role} className="bg-red-500/15 text-red-600 border-0 text-[10px] px-1.5 py-0"><Crown className="w-2.5 h-2.5 mr-0.5" />Super</Badge>;
      case "client":
        return <Badge key={role} className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] px-1.5 py-0"><User className="w-2.5 h-2.5 mr-0.5" />Cliente</Badge>;
      default:
        return <Badge key={role} className="bg-muted text-muted-foreground border-0 text-[10px] px-1.5 py-0"><User className="w-2.5 h-2.5 mr-0.5" />User</Badge>;
    }
  };

  const deleteTarget = users.find(u => u.user_id === deleteUserId);
  const resetTarget = resetResult ? users.find(u => u.user_id === resetResult.userId) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Gerenciar Usuários</CardTitle>
              <CardDescription>{users.length} usuários no sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, organização ou papel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 lowercase"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredUsers.map(u => (
                <div key={u.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || "Sem nome"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {u.roles.map(r => getRoleBadge(r))}
                      <span className="text-[10px] text-muted-foreground">• {u.org_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                      onClick={() => resetMutation.mutate(u.user_id)}
                      disabled={resetMutation.isPending}
                      title="Resetar senha"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteUserId(u.user_id)}
                      title="Excluir usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum usuário encontrado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.full_name || "este usuário"}</strong>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password result */}
      <AlertDialog open={!!resetResult} onOpenChange={() => { setResetResult(null); setCopiedPassword(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Senha Resetada</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>A nova senha de <strong>{resetTarget?.full_name || "usuário"}</strong> foi gerada:</p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="text-lg font-mono font-bold text-foreground flex-1">{resetResult?.password}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyPassword}>
                    {copiedPassword ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Anote esta senha. Ela não será exibida novamente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
