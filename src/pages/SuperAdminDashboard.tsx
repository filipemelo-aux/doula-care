import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Building2, Users, Ban, CheckCircle, LogOut, BarChart3, Clock, ShieldCheck, Mail, CalendarDays, Baby, Trash2, RefreshCw, Bell, CreditCard, Menu, Users2, Zap, Home, UserCog, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react";
import Forum from "@/pages/Forum";
import { APP_VERSION } from "@/lib/appVersion";
import { PlanPricingCard } from "@/components/superadmin/PlanPricingCard";
import { PlanLimitsCard } from "@/components/superadmin/PlanLimitsCard";
import { OrgBillingCard } from "@/components/superadmin/OrgBillingCard";
import { UserManagementCard } from "@/components/superadmin/UserManagementCard";
import { BroadcastNotificationCard } from "@/components/superadmin/BroadcastNotificationCard";
import { PromoTriggerButton } from "@/components/superadmin/PromoTriggerButton";
import { ModerationSection } from "@/components/superadmin/ModerationSection";
import { TopActiveOrgsCard } from "@/components/superadmin/TopActiveOrgsCard";
import { useOnlineOrgs } from "@/hooks/useOnlineOrgs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Section = "dashboard" | "moderation" | "users" | "billing" | "notifications" | "community" | "profile";

const sidebarItems: { key: Section; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Painel", icon: Home },
  { key: "users", label: "Usuários", icon: Users },
  { key: "billing", label: "Planos & Cobranças", icon: CreditCard },
  { key: "notifications", label: "Notificações", icon: Bell },
  { key: "community", label: "Comunidade", icon: Users2 },
  { key: "profile", label: "Meu Perfil", icon: UserCog },
  { key: "moderation", label: "Moderação", icon: Shield },
];

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
  pro: "bg-primary/10 text-primary",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function ProfileSection() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["super-admin-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alterar Senha</CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword} variant="outline" className="w-full">
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { signOut, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onlineOrgIds, onlineOrgNames } = useOnlineOrgs();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["super-admin-orgs"],
    queryFn: async () => {
      const [{ data: orgs, error }, { data: counts }] = await Promise.all([
        supabase.from("organizations").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_org_client_counts" as any),
      ]);

      if (error) throw error;

      const countMap = new Map(
        ((counts as any[]) || []).map((c: any) => [c.organization_id, Number(c.client_count)])
      );

      return (orgs || []).map((org) => ({
        ...org,
        client_count: countMap.get(org.id) || 0,
      })) as OrgWithCounts[];
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
      <Card className="group hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{initials}</span>
              {onlineOrgIds.has(org.id) && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" title="Online agora" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground truncate">{org.name}</h3>
                <Badge variant="outline" className={`text-[10px] h-5 ${planBadgeStyles[org.plan]}`}>
                  {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                </Badge>
                <Badge variant={org.status === "ativo" ? "default" : "destructive"} className="text-[10px] h-5">
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
          <div className="mt-2">
            <PromoTriggerButton orgId={org.id} orgName={org.name} />
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
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
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => statusMutation.mutate({ orgId: org.id, status: "suspenso" })} disabled={statusMutation.isPending}>
                <Ban className="h-3.5 w-3.5 mr-1" />
                Suspender
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => statusMutation.mutate({ orgId: org.id, status: "ativo" })} disabled={statusMutation.isPending}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Ativar
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir organização</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir <strong>{org.name}</strong>? Esta ação é irreversível e apagará todos os dados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(org.id)}>
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
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
    <Card className="bg-amber-50/30 dark:bg-amber-950/10">
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
        <div className="flex items-center gap-2 mt-3 pt-3 border-t dark:border-amber-800/30">
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
            onClick={() => approveMutation.mutate({ orgId: org.id, plan: approvalPlans[org.id] || "free" })}
            disabled={approveMutation.isPending}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Aprovar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const MetricsCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Card className={cn(onlineOrgIds.size > 0 ? "bg-success/5 cursor-pointer hover:shadow-md transition-shadow" : "")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", onlineOrgIds.size > 0 ? "bg-success/15" : "bg-muted")}>
                <span className={cn("h-3 w-3 rounded-full", onlineOrgIds.size > 0 ? "bg-success animate-pulse" : "bg-muted-foreground/30")} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{onlineOrgIds.size}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Online agora</p>
              </div>
            </CardContent>
          </Card>
        </PopoverTrigger>
        {onlineOrgNames.length > 0 && (
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Doulas online</p>
            <div className="space-y-0.5">
              {onlineOrgNames.map((o) => (
                <div key={o.orgId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm">
                  <span className="h-2 w-2 rounded-full bg-success shrink-0" />
                  <span className="truncate">{o.name}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
      <Card className="bg-primary/5">
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
      <Card className={pendingOrgs.length > 0 ? "bg-warning/5" : ""}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", pendingOrgs.length > 0 ? "bg-warning/15" : "bg-muted")}>
            <Clock className={cn("h-5 w-5", pendingOrgs.length > 0 ? "text-warning animate-pulse" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingOrgs.length}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Pendentes</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
            <Users className="h-5 w-5 text-success" />
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
  );

  const renderSidebarNav = (onNavigate?: () => void) => (
    <div className="flex flex-col flex-1">
      <div className="h-20 flex items-center gap-3 px-6 border-b border-sidebar-border shrink-0">
        <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
          <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
        </div>
        <div>
          <h1 className="font-display text-lg text-sidebar-foreground">Doula Care</h1>
          <p className="text-xs text-sidebar-foreground/60">Super Admin</p>
        </div>
      </div>
      <nav className="flex-1 p-3 pt-4 space-y-1">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setActiveSection(item.key);
              onNavigate?.();
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
              activeSection === item.key
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-5">
            <MetricsCards />
            <TopActiveOrgsCard />
            {pendingOrgs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
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
            {activeOrgs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Ativas ({activeOrgs.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeOrgs.map((org) => (
                    <OrgCard key={org.id} org={org} />
                  ))}
                </div>
              </div>
            )}
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
          </div>
        );
      case "moderation":
        return <ModerationSection />;
      case "users":
        return <UserManagementCard />;
      case "billing":
        return (
          <div className="space-y-6">
            <PlanLimitsCard />
            <PlanPricingCard />
            <OrgBillingCard />
          </div>
        );
      case "notifications":
        return <BroadcastNotificationCard />;
      case "community":
        return <Forum />;
      case "profile":
        return <ProfileSection />;
    }
  };

  return (
    <div className="app-shell h-[100dvh] min-h-0 bg-background flex flex-col overflow-hidden">
      <header className="h-14 shrink-0 z-20 border-b bg-card/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Super Admin</h1>
          <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive gap-1.5"
            title="Forçar atualização em TODOS os dispositivos"
            onClick={async () => {
              try {
                const now = new Date().toISOString();
                const { error } = await supabase
                  .from("system_config" as any)
                  .update({ value: now, updated_at: now } as any)
                  .eq("key", "force_update_at");
                if (error) throw error;
                toast.success("Atualização forçada enviada para todos os usuários!");
              } catch (err) {
                console.error(err);
                toast.error("Erro ao forçar atualização");
              }
            }}
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Forçar Update Global</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={async () => {
               try {
                toast.loading("Limpando cache e atualizando...", { id: "sa-update" });

                // Clear all caches
                if ("caches" in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }

                if ("serviceWorker" in navigator) {
                  const reg = await navigator.serviceWorker.getRegistration();
                  if (reg) {
                    await reg.update();

                    const waitForSW = (sw: ServiceWorker): Promise<void> =>
                      new Promise((resolve) => {
                        if (sw.state === "installed") { resolve(); return; }
                        sw.addEventListener("statechange", () => {
                          if (sw.state === "installed") resolve();
                        });
                        setTimeout(resolve, 5000);
                      });

                    if (reg.waiting) {
                      reg.waiting.postMessage({ type: "SKIP_WAITING" });
                    } else if (reg.installing) {
                      await waitForSW(reg.installing);
                      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
                    } else {
                      await new Promise<void>((resolve) => {
                        const onUpdate = () => {
                          reg.removeEventListener("updatefound", onUpdate);
                          const newSW = reg.installing;
                          if (newSW) {
                            waitForSW(newSW).then(() => {
                              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
                              resolve();
                            });
                          } else {
                            resolve();
                          }
                        };
                        reg.addEventListener("updatefound", onUpdate);
                        setTimeout(() => {
                          reg.removeEventListener("updatefound", onUpdate);
                          resolve();
                        }, 3000);
                      });
                    }
                  }
                }

                toast.success("Atualizado! Recarregando...", { id: "sa-update" });
                setTimeout(() => window.location.reload(), 600);
              } catch (err) {
                console.error(err);
                toast.error("Erro ao atualizar", { id: "sa-update" });
                window.location.reload();
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isMobile && (
          <aside className="bg-card border-r border-border flex flex-col shrink-0 w-56 relative">
            {renderSidebarNav()}
          </aside>
        )}

        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0 pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)] [&>button.absolute]:hidden">
              {renderSidebarNav(() => setSidebarOpen(false))}
            </SheetContent>
          </Sheet>
        )}

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [WebkitOverflowScrolling:touch] p-3 lg:p-8 space-y-5">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
