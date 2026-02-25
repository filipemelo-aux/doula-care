import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, Users, Ban, CheckCircle, LogOut, BarChart3, Clock, ShieldCheck, Mail, CalendarDays, Baby, Trash2 } from "lucide-react";
import { PlanPricingCard } from "@/components/superadmin/PlanPricingCard";
import { PlanLimitsCard } from "@/components/superadmin/PlanLimitsCard";
import { OrgBillingCard } from "@/components/superadmin/OrgBillingCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgWithCounts {
  id: string;
  name: string;
  responsible_email: string;
  plan: "free" | "pro" | "premium";
  status: "ativo" | "suspenso" | "pendente";
  created_at: string;
  client_count: number;
}

const planBadgeStyles: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary border-primary/20",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300/30",
};

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["super-admin-orgs"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const orgsWithCounts: OrgWithCounts[] = await Promise.all(
        (orgs || []).map(async (org) => {
          const { count } = await supabase
            .from("clients")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", org.id);

          return { ...org, client_count: count || 0 } as OrgWithCounts;
        })
      );

      return orgsWithCounts;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ orgId, plan }: { orgId: string; plan: "free" | "pro" | "premium" }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ status: "ativo" as any, plan })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success("Doula aprovada com sucesso!");
    },
    onError: () => toast.error("Erro ao aprovar"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: string }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ status: status as any })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

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

  const deleteMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-organization", {
        body: { organizationId: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success(`Organização "${data.orgName}" excluída com sucesso`);
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const pendingOrgs = organizations.filter((o) => o.status === "pendente");
  const activeOrgs = organizations.filter((o) => o.status === "ativo");
  const suspendedOrgs = organizations.filter((o) => o.status === "suspenso");
  const totalClients = organizations.reduce((sum, o) => sum + o.client_count, 0);
  const planCounts = {
    free: organizations.filter((o) => o.plan === "free").length,
    pro: organizations.filter((o) => o.plan === "pro").length,
    premium: organizations.filter((o) => o.plan === "premium").length,
  };

  const [approvalPlans, setApprovalPlans] = useState<Record<string, "free" | "pro" | "premium">>({});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const OrgCard = ({ org }: { org: OrgWithCounts }) => {
    const initials = org.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <Card className="group hover:shadow-md transition-all duration-200 border-border/60">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground truncate">{org.name}</h3>
                <Badge variant="outline" className={`text-[10px] h-5 ${planBadgeStyles[org.plan]}`}>
                  {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                </Badge>
                <Badge
                  variant={org.status === "ativo" ? "default" : "destructive"}
                  className="text-[10px] h-5"
                >
                  {org.status === "ativo" ? "Ativo" : "Suspenso"}
                </Badge>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{org.responsible_email}</span>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Baby className="h-3 w-3" />
                  {org.client_count} gestante{org.client_count !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
            <Select
              value={org.plan}
              onValueChange={(value) =>
                planMutation.mutate({ orgId: org.id, plan: value as "free" | "pro" | "premium" })
              }
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>

            {org.status === "ativo" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => statusMutation.mutate({ orgId: org.id, status: "suspenso" })}
                disabled={statusMutation.isPending}
              >
                <Ban className="h-3.5 w-3.5 mr-1" />
                Suspender
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => statusMutation.mutate({ orgId: org.id, status: "ativo" })}
                disabled={statusMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Ativar
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir organização</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir <strong>{org.name}</strong>? Esta ação é irreversível e apagará todos os dados: gestantes, contrações, diários, pagamentos, consultas e contas de usuário associadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate(org.id)}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Excluir permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  };

  const PendingOrgCard = ({ org }: { org: OrgWithCounts }) => (
    <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-sm text-foreground">{org.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{org.responsible_email}</p>
            <p className="text-[11px] text-muted-foreground">
              {format(new Date(org.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
          <Select
            value={approvalPlans[org.id] || "free"}
            onValueChange={(value) =>
              setApprovalPlans((prev) => ({ ...prev, [org.id]: value as "free" | "pro" | "premium" }))
            }
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              approveMutation.mutate({
                orgId: org.id,
                plan: approvalPlans[org.id] || "free",
              })
            }
            disabled={approveMutation.isPending}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Aprovar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Super Admin</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/15">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{organizations.length}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Organizações</p>
              </div>
            </CardContent>
          </Card>

          <Card className={pendingOrgs.length > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-300/30" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingOrgs.length > 0 ? "bg-amber-200/50 dark:bg-amber-800/30" : "bg-muted"}`}>
                <Clock className={`h-5 w-5 ${pendingOrgs.length > 0 ? "text-amber-600 animate-pulse" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingOrgs.length}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Pendentes</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalClients}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Gestantes total</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-[11px] font-medium text-muted-foreground">Distribuição</p>
              </div>
              <div className="space-y-1">
                {([["Free", planCounts.free], ["Pro", planCounts.pro], ["Premium", planCounts.premium]] as const).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending approvals */}
        {pendingOrgs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-foreground">
                Pendentes de Aprovação ({pendingOrgs.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingOrgs.map((org) => (
                <PendingOrgCard key={org.id} org={org} />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="orgs" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="orgs" className="flex-1 sm:flex-initial">Organizações</TabsTrigger>
            <TabsTrigger value="billing" className="flex-1 sm:flex-initial">Planos & Cobranças</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="space-y-4">
            {/* Active */}
            {activeOrgs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Ativas ({activeOrgs.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeOrgs.map((org) => (
                    <OrgCard key={org.id} org={org} />
                  ))}
                </div>
              </div>
            )}

            {/* Suspended */}
            {suspendedOrgs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  Suspensas ({suspendedOrgs.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {suspendedOrgs.map((org) => (
                    <OrgCard key={org.id} org={org} />
                  ))}
                </div>
              </div>
            )}

            {organizations.filter((o) => o.status !== "pendente").length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma organização ativa ou suspensa
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <PlanLimitsCard />
            <PlanPricingCard />
            <OrgBillingCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
