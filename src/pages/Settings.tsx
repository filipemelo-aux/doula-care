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
  Baby,
  Copy,
  Eye,
  EyeOff,
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

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

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

  // Fetch clients with user accounts (gestante users)
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

  // Generate password from DPP
  const generatePassword = (dpp: string): string => {
    return dpp.replace(/\D/g, "");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const togglePasswordVisibility = (clientId: string) => {
    setShowPasswords(prev => ({ ...prev, [clientId]: !prev[clientId] }));
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
          <div className="flex flex-col gap-4">
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
            <Button variant="outline" onClick={signOut} className="gap-2 w-full sm:w-auto">
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
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-info" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Backup</CardTitle>
                <CardDescription className="truncate">
                  Exportar dados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              Faça backup ou exporte relatórios.
            </p>
            <Button variant="outline" size="sm" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-warning" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Notificações</CardTitle>
                <CardDescription className="truncate">
                  Alertas e lembretes
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              Configure lembretes e alertas.
            </p>
            <Button variant="outline" size="sm" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Users List (Admin only) */}
      {isAdmin && (
        <Card className="card-glass overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Usuários</CardTitle>
                <CardDescription className="truncate">
                  Gerencie permissões
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : usersWithRoles && usersWithRoles.length > 0 ? (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap px-2">Usuário</TableHead>
                      <TableHead className="whitespace-nowrap px-2">Papel</TableHead>
                      <TableHead className="whitespace-nowrap px-2">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithRoles.map((userProfile) => (
                      <TableRow key={userProfile.id} className="table-row-hover">
                        <TableCell className="px-2 py-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[120px] sm:max-w-none">
                              {userProfile.full_name || "Sem nome"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[180px]">
                              {userProfile.user_id.slice(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
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
                        <TableCell className="text-muted-foreground whitespace-nowrap px-2 py-2 text-xs">
                          {format(new Date(userProfile.created_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum usuário cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Users (Gestantes) - Admin only */}
      {isAdmin && (
        <Card className="card-glass overflow-hidden">
          <CardHeader className="pb-2">
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
                      <TableHead className="whitespace-nowrap px-2">Email</TableHead>
                      <TableHead className="whitespace-nowrap px-2">Senha Inicial</TableHead>
                      <TableHead className="whitespace-nowrap px-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsWithAccounts.map((client) => {
                      const email = generateEmail(client.full_name);
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
                              <span className="text-xs truncate max-w-[100px] sm:max-w-[180px]">
                                {email}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => copyToClipboard(email, "Email")}
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
