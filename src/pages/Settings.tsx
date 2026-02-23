import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Heart, 
  Shield, 
  UserPlus, 
  Key, 
  LogOut,
  Loader2,
  Users,
  Crown,
  User,
  Edit2,
  Trash2,
  Check,
  Power,
  PowerOff,
  CreditCard,
  QrCode,
  Palette,
  RefreshCw,
} from "lucide-react";
import { PixSettingsCard } from "@/components/settings/PixSettingsCard";
import { BrandingSettingsCard } from "@/components/settings/BrandingSettingsCard";
import { PushNotificationStatusCard } from "@/components/settings/PushNotificationStatusCard";
import { toast } from "sonner";
import { formatBrazilDate } from "@/lib/utils";
import { ClientAccessCard } from "@/components/settings/ClientAccessCard";
import { AvatarUpload } from "@/components/gestante/AvatarUpload";
import { useForm } from "react-hook-form";
import { APP_VERSION } from "@/lib/appVersion";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";
import Plans from "@/pages/Plans";
import { usePlanLimits } from "@/hooks/usePlanLimits";

// ─── Plan Types ──────────────────────────────────────────
type PlanSetting = Tables<"plan_settings">;

const planLabels: Record<string, string> = {};

const planSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(100),
  description: z.string().max(500).optional(),
  default_value: z.number().min(0, "Valor deve ser positivo"),
  features: z.string().optional(),
  is_active: z.boolean(),
});

type PlanFormData = z.infer<typeof planSchema>;

export default function Settings() {
  const { user, isAdmin, role, signOut, profileName, organizationId } = useAuth();
  const callerIsAdmin = role === "admin";
  const callerIsModerator = role === "moderator";
  const queryClient = useQueryClient();
  const { limits, plan: orgPlan } = usePlanLimits();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch avatar
  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setAvatarUrl(data?.avatar_url || null));
    }
  }, [user]);

  // User management state
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState<{ userId: string; fullName: string; role: string; email?: string } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "moderator" as "admin" | "moderator" | "user",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Plan state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanSetting | null>(null);

  const planForm = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: "", description: "", default_value: 0, features: "", is_active: true },
  });

  // ─── Queries ─────────────────────────────────────────────
  const { data: usersWithRoles, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;

      // Only show users with admin or moderator roles
      return profiles
        .map((profile) => ({
          ...profile,
          roles: roles?.filter((r) => r.user_id === profile.user_id).map((r) => r.role) || [],
        }))
        .filter((u) => u.roles.includes("admin") || u.roles.includes("moderator"));
    },
    enabled: isAdmin,
  });

  const { data: clientsWithAccounts, isLoading: loadingClients } = useQuery({
    queryKey: ["clients-with-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, dpp, user_id, first_login, status")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ["plan-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*")
        .order("default_value", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: clientCounts } = useQuery({
    queryKey: ["client-plan-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("plan");
      if (error) throw error;
      const counts: Record<string, number> = { basico: 0, intermediario: 0, completo: 0 };
      data?.forEach((c) => { if (c.plan) counts[c.plan] = (counts[c.plan] || 0) + 1; });
      return counts;
    },
    enabled: isAdmin,
  });

  // ─── User Mutations ──────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: { ...userData, organizationId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.exists) {
        toast.info("Usuário já existe no sistema");
      } else {
        toast.success("Usuário criado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      }
      setNewUserOpen(false);
      setNewUserData({ email: "", password: "", fullName: "", role: "moderator" });
    },
    onError: (error) => toast.error("Erro ao criar usuário", { description: error.message }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, fullName, role, email }: { userId: string; fullName: string; role: string; email?: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: { action: "update", userId, fullName, role, email },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setEditUserDialog(null);
      toast.success("Usuário atualizado!");
    },
    onError: (error) => toast.error("Erro ao atualizar", { description: error.message }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setDeleteUserId(null);
      toast.success("Usuário excluído!");
    },
    onError: (error) => toast.error("Erro ao excluir", { description: error.message }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setChangePasswordOpen(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
    },
    onError: (error) => toast.error("Erro ao alterar senha", { description: error.message }),
  });

  // ─── Plan Mutations ──────────────────────────────────────
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description: string | null; default_value: number; features: string[] | null; is_active: boolean }) => {
      const { error } = await supabase.from("plan_settings").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Plano atualizado!");
      setPlanDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: () => toast.error("Erro ao atualizar plano"),
  });

  const togglePlanMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("plan_settings").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Status do plano atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // ─── Handlers ────────────────────────────────────────────
  const handleCreateUser = () => {
    if (!limits.multiCollaborators) {
      toast.error("Seu plano não permite criar usuários adicionais. Faça upgrade para o Premium.");
      return;
    }
    const currentUserCount = usersWithRoles?.length || 0;
    if (currentUserCount >= limits.maxCollaborators) {
      toast.error(`Seu plano permite no máximo ${limits.maxCollaborators} colaboradores.`);
      return;
    }
    if (!newUserData.email || !newUserData.password) {
      toast.error("Preencha email e senha");
      return;
    }
    createUserMutation.mutate(newUserData);
  };

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    changePasswordMutation.mutate(passwordData.newPassword);
  };

  const openEditUser = async (profile: any) => {
    const adminRole = profile.roles.find((r: string) => r !== "client") || "user";
    setEditName(profile.full_name || "");
    setEditRole(adminRole);
    setEditEmail("");
    setEditUserDialog({ userId: profile.user_id, fullName: profile.full_name || "", role: adminRole });

    // Fetch email from edge function
    try {
      const { data } = await supabase.functions.invoke("get-client-email", {
        body: { userId: profile.user_id },
      });
      if (data?.email) setEditEmail(data.email);
    } catch {}
  };

  const handleEditPlan = (plan: PlanSetting) => {
    setSelectedPlan(plan);
    planForm.reset({
      name: plan.name,
      description: plan.description || "",
      default_value: Number(plan.default_value),
      features: plan.features?.join("\n") || "",
      is_active: plan.is_active ?? true,
    });
    setPlanDialogOpen(true);
  };

  const onPlanSubmit = (data: PlanFormData) => {
    if (!selectedPlan) return;
    updatePlanMutation.mutate({
      id: selectedPlan.id,
      name: data.name,
      description: data.description || null,
      default_value: data.default_value,
      features: data.features ? data.features.split("\n").filter(Boolean) : null,
      is_active: data.is_active,
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0"><Crown className="w-2.5 h-2.5 mr-0.5" />Admin</Badge>;
      case "moderator":
        return <Badge className="bg-warning/15 text-warning border-0 text-[10px] px-1.5 py-0"><Shield className="w-2.5 h-2.5 mr-0.5" />Mod</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-0 text-[10px] px-1.5 py-0"><User className="w-2.5 h-2.5 mr-0.5" />User</Badge>;
    }
  };

  const isCurrentUser = (userId: string) => userId === user?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-description">Gerencie usuários, planos e preferências</p>
      </div>

      {/* Current User Info */}
      <Card className="card-glass border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentUrl={avatarUrl}
                onUploaded={setAvatarUrl}
                userId={user?.id}
                name={profileName || ""}
                size="lg"
              />
              <div>
                <h3 className="font-semibold text-foreground">{profileName || user?.email}</h3>
                <p className="text-sm text-muted-foreground">{callerIsAdmin ? "Administrador" : callerIsModerator ? "Moderador" : "Usuário"}</p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut} className="gap-2 w-full sm:w-auto">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="w-full grid grid-cols-5 gap-0 p-1">
          <TabsTrigger value="users" className="px-1 text-xs sm:text-sm gap-1"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span className="truncate">Usuários</span></TabsTrigger>
          <TabsTrigger value="plans" className="px-1 text-xs sm:text-sm gap-1"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span className="truncate">Planos</span></TabsTrigger>
          <TabsTrigger value="branding" className="px-1 text-xs sm:text-sm gap-1"><Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span className="truncate">Marca</span></TabsTrigger>
          <TabsTrigger value="pix" className="px-1 text-xs sm:text-sm gap-1"><QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span className="truncate">Pix</span></TabsTrigger>
          <TabsTrigger value="security" className="px-1 text-xs sm:text-sm gap-1"><Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span className="truncate">Segurança</span></TabsTrigger>
        </TabsList>

        {/* ─── USERS TAB ─── */}
        <TabsContent value="users" className="space-y-6">
          {isAdmin && (
            <>
              {/* Admin Users */}
              <Card className="card-glass overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Usuários do Sistema</CardTitle>
                        <CardDescription>Gerencie permissões e acessos</CardDescription>
                      </div>
                    </div>
                    {limits.multiCollaborators ? (
                      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><UserPlus className="h-4 w-4 mr-1" />Novo</Button>
                        </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Novo Usuário</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input value={newUserData.fullName} onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })} placeholder="Nome do usuário" />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={newUserData.email} onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })} placeholder="email@exemplo.com" />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha</Label>
                            <Input type="password" value={newUserData.password} onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })} placeholder="••••••••" />
                          </div>
                          <div className="space-y-2">
                            <Label>Permissão</Label>
                            <Select value={newUserData.role} onValueChange={(v: "admin" | "moderator" | "user") => setNewUserData({ ...newUserData, role: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Usuário</SelectItem>
                                <SelectItem value="moderator">Moderador</SelectItem>
                                {callerIsAdmin && <SelectItem value="admin">Administrador</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleCreateUser} className="w-full" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Usuário"}
                          </Button>
                        </div>
                      </DialogContent>
                      </Dialog>
                    ) : (
                      <Button size="sm" variant="outline" disabled title="Disponível apenas no plano Premium">
                        <Crown className="h-4 w-4 mr-1" />Premium
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  {loadingUsers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : usersWithRoles && usersWithRoles.length > 0 ? (
                    <div className="-mx-2 sm:mx-0">
                      <Table className="text-xs sm:text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-2">Usuário</TableHead>
                            <TableHead className="px-2">Papel</TableHead>
                            <TableHead className="px-2 w-20">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersWithRoles.map((userProfile) => (
                            <TableRow key={userProfile.id} className="table-row-hover">
                              <TableCell className="px-2 py-1.5">
                                <div className="min-w-0">
                                  <p className="font-medium truncate text-xs sm:text-sm max-w-[120px] sm:max-w-none">
                                    {userProfile.full_name || "Sem nome"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatBrazilDate(userProfile.created_at, "dd/MM/yy")}
                                    {isCurrentUser(userProfile.user_id) && (
                                      <span className="ml-1 text-primary">(você)</span>
                                    )}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                <div className="flex flex-wrap gap-0.5">
                                  {userProfile.roles.length > 0
                                    ? userProfile.roles.filter((r: string) => r !== "client").map((role: string) => (
                                        <span key={role}>{getRoleBadge(role)}</span>
                                      ))
                                    : getRoleBadge("user")}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                {(() => {
                                  const targetIsAdmin = userProfile.roles.includes("admin");
                                  const canManage = callerIsAdmin || (callerIsModerator && !targetIsAdmin);
                                  return (
                                    <div className="flex items-center gap-1">
                                      {canManage && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => openEditUser(userProfile)}
                                          title="Editar"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {canManage && !isCurrentUser(userProfile.user_id) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => setDeleteUserId(userProfile.user_id)}
                                          title="Excluir"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</p>
                  )}
                </CardContent>
              </Card>

              {/* Client Users */}
              <ClientAccessCard clientsWithAccounts={clientsWithAccounts} loadingClients={loadingClients} />
            </>
          )}
        </TabsContent>

        {/* ─── PLANS TAB ─── */}
        <TabsContent value="plans" className="space-y-6">
          <Plans />
        </TabsContent>

        {/* ─── BRANDING TAB ─── */}
        <TabsContent value="branding" className="space-y-6">
          <BrandingSettingsCard />
        </TabsContent>
        {/* ─── PIX TAB ─── */}
        <TabsContent value="pix" className="space-y-6">
          <PixSettingsCard />
        </TabsContent>

        {/* ─── SECURITY TAB ─── */}
        <TabsContent value="security" className="space-y-6">
          <PushNotificationStatusCard />
          <Card className="card-glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-success" />
                </div>
                <div>
                  <CardTitle className="text-lg">Segurança</CardTitle>
                  <CardDescription>Autenticação e controle de acesso</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Key className="w-4 h-4" /> Alterar Senha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <Input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha</Label>
                      <Input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="••••••••" />
                    </div>
                    <Button onClick={handleChangePassword} className="w-full" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Nova Senha"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Verificar atualizações</h3>
                    <p className="text-xs text-muted-foreground">Limpa cache e busca a versão mais recente</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      toast.loading("Verificando atualizações...", { id: "update-check" });
                      
                      // Clear all caches
                      if ("caches" in window) {
                        const names = await caches.keys();
                        await Promise.all(names.map((n) => caches.delete(n)));
                      }
                      
                      if ("serviceWorker" in navigator) {
                        const reg = await navigator.serviceWorker.getRegistration();
                        if (reg) {
                          // Force check for new SW
                          await reg.update();
                          
                          const waitForSW = (sw: ServiceWorker): Promise<void> =>
                            new Promise((resolve) => {
                              if (sw.state === "installed") { resolve(); return; }
                              sw.addEventListener("statechange", () => {
                                if (sw.state === "installed") resolve();
                              });
                              // Timeout fallback
                              setTimeout(resolve, 5000);
                            });

                          // If there's a waiting or installing SW, wait and activate it
                          if (reg.waiting) {
                            reg.waiting.postMessage({ type: "SKIP_WAITING" });
                          } else if (reg.installing) {
                            await waitForSW(reg.installing);
                            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
                          } else {
                            // Listen for new update found after reg.update()
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
                              // If no update found within 3s, resolve anyway
                              setTimeout(() => {
                                reg.removeEventListener("updatefound", onUpdate);
                                resolve();
                              }, 3000);
                            });
                          }
                        }
                      }
                      
                      toast.success("Atualizado! Recarregando...", { id: "update-check" });
                      setTimeout(() => window.location.reload(), 600);
                    } catch (err) {
                      console.error(err);
                      toast.error("Erro ao verificar atualizações", { id: "update-check" });
                    }
                  }}
                >
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Heart className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Doula Care Dashboard</h3>
                  <p className="text-sm text-muted-foreground">v{APP_VERSION} • Desenvolvido com ❤️ para profissionais de doula</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}

      {/* Edit User Dialog */}
      <Dialog open={!!editUserDialog} onOpenChange={(o) => !o && setEditUserDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Permissão</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  {callerIsAdmin && <SelectItem value="admin">Administrador</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={updateUserMutation.isPending}
              onClick={() => {
                if (editUserDialog) {
                  updateUserMutation.mutate({ userId: editUserDialog.userId, fullName: editName, role: editRole, email: editEmail || undefined });
                }
              }}
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(o) => !o && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será removido permanentemente do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-xl">Editar Plano</DialogTitle></DialogHeader>
          <Form {...planForm}>
            <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4">
              <FormField control={planForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome do Plano *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={planForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] resize-none" placeholder="Descreva o plano..." /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={planForm.control} name="default_value" render={({ field }) => (
                <FormItem><FormLabel>Valor (R$) *</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={planForm.control} name="features" render={({ field }) => (
                <FormItem><FormLabel>Serviços Inclusos</FormLabel><FormControl><Textarea {...field} className="min-h-[120px] resize-none" placeholder={"Um serviço por linha:\nConsultas mensais\nSuporte via WhatsApp"} /></FormControl><p className="text-xs text-muted-foreground">Um serviço por linha</p><FormMessage /></FormItem>
              )} />
              <FormField control={planForm.control} name="is_active" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div><FormLabel className="text-base">Plano Ativo</FormLabel><p className="text-sm text-muted-foreground">Planos inativos não aparecem para novas contratações</p></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={updatePlanMutation.isPending}>{updatePlanMutation.isPending ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
