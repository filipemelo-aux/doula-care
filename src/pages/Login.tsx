import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn, user, role, roleChecked, loading, isAdmin, isClient, isFirstLogin } = useAuth();

  useEffect(() => {
    if (!loading && user && roleChecked && role) {
      if (role === "admin" || role === "moderator") {
        navigate("/admin", { replace: true });
      } else if (role === "client") {
        if (isFirstLogin) {
          navigate("/gestante/alterar-senha", { replace: true });
        } else {
          navigate("/gestante", { replace: true });
        }
      }
    }
  }, [loading, user, role, roleChecked, isFirstLogin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!email || !password) {
      toast.error("Preencha todos os campos");
      setSubmitting(false);
      return;
    }

    const { error } = await signIn(email.trim(), password);

    if (error) {
      toast.error("Erro ao fazer login", {
        description: "Credenciais incorretas. Verifique e tente novamente.",
      });
      setSubmitting(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
  };

  if (loading && !submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitting && user && !roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (user && roleChecked && role) {
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
          <div className="mx-auto w-28 h-28 flex items-center justify-center">
            <img src={logo} alt="Papo de Doula" className="w-28 h-28 object-contain drop-shadow-lg" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Papo de Doula</CardTitle>
            <CardDescription>Entre com seu email e senha</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Usuário</Label>
              <Input
                id="email"
                type="text"
                placeholder="Digite seu usuário"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                autoComplete="email"
                autoCapitalize="off"
                className="input-field lowercase"
                style={{ textTransform: "lowercase" }}
              />
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
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
