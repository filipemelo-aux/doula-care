import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  Shield, 
  Database, 
  Bell, 
  UserPlus, 
  Key, 
  LogOut,
  Loader2,
  Users,
  Crown,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Settings() {
  const { user, isAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "user" as "admin" | "moderator" | "user",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // Fetch users with roles (admin only)
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

      return profiles.map((profile) => ({
        ...profile,
        roles: roles?.filter((r) => r.user_id === profile.user_id).map((r) => r.role) || [],
      }));
    },
    enabled: isAdmin,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: userData,
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
      setNewUserData({ email: "", password: "", fullName: "", role: "user" });
    },
    onError: (error) => {
      toast.error("Erro ao criar usuário", {
        description: error.message,
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setChangePasswordOpen(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
    },
    onError: (error) => {
      toast.error("Erro ao alterar senha", {
        description: error.message,
      });
    },
  });

  const handleCreateUser = () => {
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary/15 text-primary border-0"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
      case "moderator":
        return <Badge className="bg-warning/15 text-warning border-0"><Shield className="w-3 h-3 mr-1" />Moderador</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-0"><User className="w-3 h-3 mr-1" />Usuário</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-description">
          Gerencie as configurações do seu dashboard
        </p>
      </div>

      {/* Current User Info */}
      <Card className="card-glass border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {user?.email}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? "Administrador" : "Usuário"}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security Card */}
        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>
                  Autenticação e controle de acesso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Change Password */}
            <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Key className="w-4 h-4" />
                  Alterar Senha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Senha</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nova Senha</Label>
                    <Input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha</Label>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      placeholder="••••••••"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    className="w-full"
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Salvar Nova Senha"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Create User (Admin only) */}
            {isAdmin && (
              <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <UserPlus className="w-4 h-4" />
                    Criar Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input
                        value={newUserData.fullName}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, fullName: e.target.value })
                        }
                        placeholder="Nome do usuário"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newUserData.email}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, email: e.target.value })
                        }
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <Input
                        type="password"
                        value={newUserData.password}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, password: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permissão</Label>
                      <Select
                        value={newUserData.role}
                        onValueChange={(value: "admin" | "moderator" | "user") =>
                          setNewUserData({ ...newUserData, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="moderator">Moderador</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateUser}
                      className="w-full"
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Criar Usuário"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Perfil Profissional</CardTitle>
                <CardDescription>
                  Informações sobre você e sua prática
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure suas informações profissionais, especialidades e dados de contato.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-info" />
              </div>
              <div>
                <CardTitle className="text-lg">Backup de Dados</CardTitle>
                <CardDescription>
                  Exportar e importar dados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Faça backup dos seus dados ou exporte relatórios em diferentes formatos.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações</CardTitle>
                <CardDescription>
                  Alertas e lembretes
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure lembretes de consultas, vencimentos e alertas importantes.
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Users List (Admin only) */}
      {isAdmin && (
        <Card className="card-glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Usuários do Sistema</CardTitle>
                <CardDescription>
                  Gerencie os usuários e suas permissões
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : usersWithRoles && usersWithRoles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithRoles.map((userProfile) => (
                    <TableRow key={userProfile.id} className="table-row-hover">
                      <TableCell>
                        <div>
                          <p className="font-medium">{userProfile.full_name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{userProfile.user_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userProfile.roles.length > 0 ? (
                            userProfile.roles.map((role) => (
                              <span key={role}>{getRoleBadge(role)}</span>
                            ))
                          ) : (
                            getRoleBadge("user")
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(userProfile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum usuário cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="card-glass border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Doula Care Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Versão 1.0 • Desenvolvido com ❤️ para profissionais de doula
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
