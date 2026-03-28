import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Baby, Copy, Eye, EyeOff, Loader2, UserPlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Client {
  id: string;
  full_name: string;
  dpp: string | null;
  user_id: string | null;
  first_login: boolean | null;
  status: string;
}

interface ClientAccessCardProps {
  clientsWithAccounts: Client[] | undefined;
  loadingClients: boolean;
}

const generateUsername = (fullName: string): string => {
  const normalized = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const parts = normalized.split(/\s+/);
  return parts.length < 2 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
};

const generatePassword = (dpp: string): string => {
  const parts = dpp.split("-");
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0].slice(-2)}`;
  }
  return dpp.replace(/\D/g, "").slice(0, 6);
};

export function ClientAccessCard({ clientsWithAccounts, loadingClients }: ClientAccessCardProps) {
  const queryClient = useQueryClient();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [resettingClientId, setResettingClientId] = useState<string | null>(null);
  const [resetConfirmClient, setResetConfirmClient] = useState<Client | null>(null);
  const [resettingData, setResettingData] = useState(false);

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("provision-existing-clients");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.created > 0) {
        toast.success(`${data.created} usuário(s) criado(s) com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["clients-with-accounts"] });
      } else {
        toast.info("Nenhuma gestante pendente encontrada");
      }
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} erro(s) durante a criação`, { description: data.errors.slice(0, 3).join(", ") });
      }
    },
    onError: (error) => toast.error("Erro ao criar usuários", { description: error.message }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (clientId: string) => {
      setResettingClientId(clientId);
      const { data, error } = await supabase.functions.invoke("reset-client-password", { body: { clientId } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Senha resetada!", { description: data.hint });
      queryClient.invalidateQueries({ queryKey: ["clients-with-accounts"] });
      setResettingClientId(null);
    },
    onError: (error) => {
      toast.error("Erro ao resetar senha", { description: error.message });
      setResettingClientId(null);
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleResetTestData = async () => {
    if (!resetConfirmClient) return;
    setResettingData(true);
    try {
      const clientId = resetConfirmClient.id;
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from("contractions").delete().eq("client_id", clientId),
        supabase.from("pregnancy_diary").delete().eq("client_id", clientId),
        supabase.from("client_notifications").delete().eq("client_id", clientId),
        supabase.from("service_requests").delete().eq("client_id", clientId),
        supabase.from("appointments").delete().eq("client_id", clientId),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (r3.error) throw r3.error;
      if (r4.error) throw r4.error;
      if (r5.error) throw r5.error;

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          labor_started_at: null,
          birth_occurred: false,
          birth_date: null,
          birth_time: null,
          birth_weight: null,
          birth_height: null,
          status: "gestante" as const,
          custom_status: null,
          baby_names: [],
        })
        .eq("id", clientId);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-accounts"] });
      setResetConfirmClient(null);
      toast.success("Dados limpos!");
    } catch {
      toast.error("Erro ao limpar dados");
    } finally {
      setResettingData(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Baby className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Acessos Gestantes</h3>
              <p className="text-xs text-muted-foreground">{clientsWithAccounts?.length || 0} com acesso</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => provisionMutation.mutate()} disabled={provisionMutation.isPending} className="h-8 text-xs gap-1.5">
            {provisionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Criar
          </Button>
        </div>
        <div className="px-4 pb-4">
          {loadingClients ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : clientsWithAccounts && clientsWithAccounts.length > 0 ? (
            <div className="space-y-1">
              {clientsWithAccounts.map((client) => {
                const username = generateUsername(client.full_name);
                const password = client.dpp ? generatePassword(client.dpp) : "N/A";
                const isPasswordVisible = showPasswords[client.id];

                return (
                  <div key={client.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-accent">
                        {client.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{client.full_name.split(" ")[0]}</p>
                        {client.first_login ? (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-warning/10 text-warning border-0">Aguard.</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-success/10 text-success border-0">Ativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">{username}</span>
                        <button onClick={() => copyToClipboard(username, "Usuário")} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-[10px] text-muted-foreground/40 mx-0.5">•</span>
                        {client.first_login ? (
                          <>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {isPasswordVisible ? password : "••••••"}
                            </span>
                            <button onClick={() => setShowPasswords(p => ({ ...p, [client.id]: !p[client.id] }))} className="text-muted-foreground hover:text-foreground">
                              {isPasswordVisible ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                            </button>
                            <button onClick={() => copyToClipboard(password, "Senha")} className="text-muted-foreground hover:text-foreground">
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Personalizada</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => {
                          if (confirm(`Resetar senha de ${client.full_name.split(" ")[0]}?`)) {
                            resetPasswordMutation.mutate(client.id);
                          }
                        }}
                        disabled={resettingClientId === client.id}
                        title="Resetar senha"
                      >
                        {resettingClientId === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setResetConfirmClient(client)}
                        title="Limpar dados"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma gestante com acesso</p>
          )}
        </div>
      </div>

      <AlertDialog open={!!resetConfirmClient} onOpenChange={(open) => !open && setResetConfirmClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar dados de {resetConfirmClient?.full_name?.split(" ")[0]}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">As seguintes informações serão apagadas permanentemente:</p>
                <ul className="list-disc pl-5 space-y-1 mb-3">
                  <li>Contrações registradas</li>
                  <li>Diário da gestante</li>
                  <li>Notificações enviadas</li>
                  <li>Solicitações de serviço</li>
                  <li>Consultas agendadas</li>
                  <li>Dados de trabalho de parto e nascimento</li>
                </ul>
                <p><strong>Dados financeiros serão mantidos.</strong></p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetTestData} disabled={resettingData}>
              {resettingData ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Limpar dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
