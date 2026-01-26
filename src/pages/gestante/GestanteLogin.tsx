import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

export default function GestanteLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Normalize username and append domain if needed
      let email = username.trim().toLowerCase();
      if (!email.includes("@")) {
        email = `${email}@gestante.doula.app`;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Erro ao fazer login", {
          description: "Usuário ou senha incorretos",
        });
        setLoading(false);
        return;
      }

      // Check if user is a client
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "client")
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        toast.error("Acesso negado", {
          description: "Esta área é exclusiva para gestantes",
        });
        setLoading(false);
        return;
      }

      // Check if first login
      const { data: clientData } = await supabase
        .from("clients")
        .select("first_login")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (clientData?.first_login) {
        toast.success("Bem-vinda! Por favor, altere sua senha.");
        navigate("/gestante/alterar-senha");
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/gestante");
      }
    } catch (error) {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Heart className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Área da Gestante</CardTitle>
            <CardDescription>Entre com suas credenciais para acessar sua área</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="nome.sobrenome"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="input-field lowercase"
              />
              <p className="text-xs text-muted-foreground">
                Seu usuário é seu nome.sobrenome (ex: maria.silva)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              <p className="text-xs text-muted-foreground">
                Primeira vez? Sua senha é a data prevista do parto (somente números)
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
          
          <div className="mt-6 pt-4 border-t border-border">
            <Link 
              to="/login" 
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="h-4 w-4" />
              Entrar como administrador
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
