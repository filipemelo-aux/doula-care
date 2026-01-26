import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
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
  const { signIn, isAuthenticated, isFirstLogin, loading: authLoading } = useGestanteAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isFirstLogin) {
        navigate("/gestante/alterar-senha", { replace: true });
      } else {
        navigate("/gestante", { replace: true });
      }
    }
  }, [isAuthenticated, isFirstLogin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    const { error } = await signIn(username.trim().toLowerCase(), password);

    if (error) {
      toast.error("Erro ao fazer login", {
        description: error.message === "Usuário não autorizado para esta área" 
          ? "Esta área é exclusiva para gestantes"
          : "Usuário ou senha incorretos",
      });
      setLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
    // Navigation will be handled by useEffect above
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render login form if already authenticated (prevents flash)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                autoComplete="username"
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
                  autoComplete="current-password"
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
                Primeira vez? Sua senha é a DPP no formato DDMMAA (ex: 310126)
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
              to="/admin/login" 
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
