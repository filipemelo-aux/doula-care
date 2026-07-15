import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { WelcomeNameDialog } from "@/components/gestante/WelcomeNameDialog";
import { promptToSaveUpdatedPassword } from "@/lib/passwordManager";

export default function GestanteChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [clientFullName, setClientFullName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, role, roles, setFirstLoginComplete, refreshClientData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("Senha inválida", {
        description: "Use pelo menos 6 caracteres, com uma letra maiúscula, uma minúscula e um número.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    // Guardrail: this screen is exclusively for clients (gestantes).
    // If a team member (admin/moderator/super_admin) somehow lands here on a
    // shared device or session, do not let them rewrite the client's data.
    const hasTeamRole = roles?.some((r) => ["admin", "moderator", "super_admin"].includes(r));
    if (hasTeamRole) {
      toast.error("Esta tela é exclusiva de gestantes.", {
        description: "Sua conta de equipe não pode alterar dados desta gestante.",
      });
      navigate(role === "super_admin" ? "/super-admin" : "/admin", { replace: true });
      return;
    }

    setLoading(true);

    try {
      if (user) {
        // Fetch client id + full name for the welcome dialog
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (clientData) {
          setClientFullName(clientData.full_name);
          setClientId(clientData.id);
        }

        const { error: updateError } = await supabase
          .from("clients")
          .update({ first_login: false })
          .eq("user_id", user.id);
        
        if (updateError) {
          console.error("Error updating first_login:", updateError);
          throw updateError;
        }
      }

      setFirstLoginComplete();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      await promptToSaveUpdatedPassword(newPassword, user?.email);

      await refreshClientData();

      toast.success("Senha alterada com sucesso!");
      
      // Show welcome dialog after successful password change
      setShowWelcome(true);
    } catch (error) {
      toast.error("Erro ao alterar senha", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show welcome dialog after password change
  if (showWelcome && user) {
    return (
      <WelcomeNameDialog
        fullName={clientFullName}
        userId={user.id}
        onComplete={() => {
          navigate("/gestante", { replace: true });
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Alterar Senha</CardTitle>
            <CardDescription>
              Crie uma nova senha segura para sua conta
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input-field pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres, com uma letra maiúscula, uma minúscula e um número.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="input-field"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Nova Senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
