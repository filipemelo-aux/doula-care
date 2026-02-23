import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Building2, Users, Ban, CheckCircle, LogOut, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgWithCounts {
  id: string;
  name: string;
  responsible_email: string;
  plan: "free" | "pro" | "premium";
  status: "ativo" | "suspenso";
  created_at: string;
  client_count: number;
}

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["super-admin-orgs"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch client counts per org
      const orgsWithCounts: OrgWithCounts[] = await Promise.all(
        (orgs || []).map(async (org) => {
          const { count } = await supabase
            .from("clients")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", org.id);

          return { ...org, client_count: count || 0 };
        })
      );

      return orgsWithCounts;
    },
  });

  // Update org status
  const statusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: "ativo" | "suspenso" }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ status })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Update org plan
  const planMutation = useMutation({
    mutationFn: async ({ orgId, plan }: { orgId: string; plan: "free" | "pro" | "premium" }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ plan })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success("Plano atualizado");
    },
    onError: () => toast.error("Erro ao atualizar plano"),
  });

  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter((o) => o.status === "ativo").length;
  const totalClients = organizations.reduce((sum, o) => sum + o.client_count, 0);
  const planCounts = {
    free: organizations.filter((o) => o.plan === "free").length,
    pro: organizations.filter((o) => o.plan === "pro").length,
    premium: organizations.filter((o) => o.plan === "premium").length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Painel Super Admin</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalOrgs}</p>
                  <p className="text-sm text-muted-foreground">Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{activeOrgs}</p>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalClients}</p>
                  <p className="text-sm text-muted-foreground">Gestantes total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Free: {planCounts.free} · Pro: {planCounts.pro} · Premium: {planCounts.premium}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations table */}
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Gerencie todas as contas de doulas da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Gestantes</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-muted-foreground">{org.responsible_email}</TableCell>
                    <TableCell>{org.client_count}</TableCell>
                    <TableCell>
                      <Select
                        value={org.plan}
                        onValueChange={(value) =>
                          planMutation.mutate({ orgId: org.id, plan: value as "free" | "pro" | "premium" })
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.status === "ativo" ? "default" : "destructive"}>
                        {org.status === "ativo" ? "Ativo" : "Suspenso"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {org.status === "ativo" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => statusMutation.mutate({ orgId: org.id, status: "suspenso" })}
                          disabled={statusMutation.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => statusMutation.mutate({ orgId: org.id, status: "ativo" })}
                          disabled={statusMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Ativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {organizations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma organization cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
