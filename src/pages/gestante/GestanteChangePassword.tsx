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

export default function GestanteChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [clientFullName, setClientFullName] = useState("");
  const navigate = useNavigate();
  const { user, setFirstLoginComplete, refreshClientData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      if (user) {
        // Fetch client full name for the welcome dialog
        const { data: clientData } = await supabase
          .from("clients")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (clientData) {
          setClientFullName(clientData.full_name);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
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
