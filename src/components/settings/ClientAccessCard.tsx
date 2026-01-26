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
import { Baby, Copy, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
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

// Generate password from DPP (day and month only - ddmm format)
const generatePassword = (dpp: string): string => {
  // DPP format is YYYY-MM-DD, extract day and month
  const parts = dpp.split("-");
  if (parts.length === 3) {
    const day = parts[2];
    const month = parts[1];
    return `${day}${month}`;
  }
  // Fallback: extract only numbers (first 4 digits for ddmm)
  return dpp.replace(/\D/g, "").slice(0, 4);
};

export function ClientAccessCard({ clientsWithAccounts, loadingClients }: ClientAccessCardProps) {
  const queryClient = useQueryClient();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

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

  return (
    <Card className="card-glass overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Baby className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Acessos das Gestantes</CardTitle>
              <CardDescription className="truncate">
                Credenciais de login das clientes
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => provisionMutation.mutate()}
            disabled={provisionMutation.isPending}
            className="gap-2"
          >
            {provisionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Criar Usuários Pendentes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {loadingClients ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : clientsWithAccounts && clientsWithAccounts.length > 0 ? (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap px-2">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap px-2">Usuário</TableHead>
                  <TableHead className="whitespace-nowrap px-2">Senha Inicial</TableHead>
                  <TableHead className="whitespace-nowrap px-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsWithAccounts.map((client) => {
                  const username = generateUsername(client.full_name);
                  const password = client.dpp ? generatePassword(client.dpp) : "N/A";
                  const isPasswordVisible = showPasswords[client.id];
                  
                  return (
                    <TableRow key={client.id} className="table-row-hover">
                      <TableCell className="px-2 py-2">
                        <p className="font-medium truncate max-w-[120px] sm:max-w-none">
                          {client.full_name}
                        </p>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono truncate max-w-[100px] sm:max-w-[180px]">
                            {username}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => copyToClipboard(username, "Usuário")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono">
                            {isPasswordVisible ? password : "••••••••"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => togglePasswordVisibility(client.id)}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => copyToClipboard(password, "Senha")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        {client.first_login ? (
                          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                            Aguardando
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                            Ativo
                          </Badge>
                        )}
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
