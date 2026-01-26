import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Baby, Copy, Eye, EyeOff, Loader2, UserPlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Generate email from full name
const generateEmail = (fullName: string): string => {
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) {
    return `${parts[0]}@gestante.doula.app`;
  }
  return `${parts[0]}.${parts[parts.length - 1]}@gestante.doula.app`;
};

// Generate username (without @domain)
const generateUsername = (fullName: string): string => {
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) {
    return parts[0];
  }
  return `${parts[0]}.${parts[parts.length - 1]}`;
};

// Generate password from DPP (DDMMAA format - day, month, year last 2 digits)
const generatePassword = (dpp: string): string => {
  // DPP format is YYYY-MM-DD
  const parts = dpp.split("-");
  if (parts.length === 3) {
    const year = parts[0].slice(-2); // last 2 digits of year
    const month = parts[1];
    const day = parts[2];
    return `${day}${month}${year}`;
  }
  // Fallback
  return dpp.replace(/\D/g, "").slice(0, 6);
};

export function ClientAccessCard({ clientsWithAccounts, loadingClients }: ClientAccessCardProps) {
  const queryClient = useQueryClient();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [resettingClientId, setResettingClientId] = useState<string | null>(null);
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
      if (data.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} erro(s) durante a criação`, {
          description: data.errors.slice(0, 3).join(", "),
        });
      }
    },
    onError: (error) => {
      toast.error("Erro ao criar usuários", {
        description: error.message,
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const togglePasswordVisibility = (clientId: string) => {
    setShowPasswords(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async (clientId: string) => {
      setResettingClientId(clientId);
      const { data, error } = await supabase.functions.invoke("reset-client-password", {
        body: { clientId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Senha resetada com sucesso!", {
        description: data.hint,
      });
      queryClient.invalidateQueries({ queryKey: ["clients-with-accounts"] });
      setResettingClientId(null);
    },
    onError: (error) => {
      toast.error("Erro ao resetar senha", {
        description: error.message,
      });
      setResettingClientId(null);
    },
  });

  const handleResetPassword = (clientId: string, clientName: string) => {
    if (confirm(`Deseja resetar a senha de ${clientName}?\n\nA nova senha será o dia e mês da DPP (formato DDMM).`)) {
      resetPasswordMutation.mutate(clientId);
    }
  };

  return (
    <Card className="card-glass">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Baby className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Acessos Gestantes</CardTitle>
              <CardDescription className="text-xs truncate">
                Credenciais das clientes
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => provisionMutation.mutate()}
            disabled={provisionMutation.isPending}
            className="gap-1.5 text-xs h-8"
          >
            {provisionMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <UserPlus className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">Criar Pendentes</span>
            <span className="sm:hidden">Criar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pt-0">
        {loadingClients ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : clientsWithAccounts && clientsWithAccounts.length > 0 ? (
          <div className="-mx-2 sm:mx-0">
            <Table className="text-xs sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2">Cliente</TableHead>
                  <TableHead className="px-2 hidden sm:table-cell">Usuário</TableHead>
                  <TableHead className="px-2">Senha</TableHead>
                  <TableHead className="px-2 w-16">Status</TableHead>
                  <TableHead className="px-2 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsWithAccounts.map((client) => {
                  const username = generateUsername(client.full_name);
                  const password = client.dpp ? generatePassword(client.dpp) : "N/A";
                  const isPasswordVisible = showPasswords[client.id];
                  
                  return (
                    <TableRow key={client.id} className="table-row-hover">
                      <TableCell className="px-2 py-1.5">
                        <div className="min-w-0">
                          <p className="font-medium truncate text-xs sm:text-sm max-w-[80px] sm:max-w-[120px]">
                            {client.full_name.split(' ')[0]}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate sm:hidden">
                            {username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5 hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono truncate max-w-[100px]">
                            {username}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => copyToClipboard(username, "Usuário")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {client.first_login ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono min-w-[52px]">
                              {isPasswordVisible ? password : "••••••"}
                            </span>
                            <div className="flex items-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => togglePasswordVisibility(client.id)}
                              >
                                {isPasswordVisible ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => copyToClipboard(password, "Senha")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground italic cursor-help">
                                Personalizada
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Usuária alterou a senha. Use o botão de reset para restaurar.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {client.first_login ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/30">
                            Aguard.
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-success/30">
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleResetPassword(client.id, client.full_name)}
                              disabled={resettingClientId === client.id}
                            >
                              {resettingClientId === client.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Resetar senha</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma gestante com acesso criado
          </p>
        )}
      </CardContent>
    </Card>
  );
}
