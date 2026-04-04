import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getCachedBranding } from "@/hooks/useOrgBranding";
import { promptToSavePassword, rememberLastLoginIdentifier } from "@/lib/passwordManager";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const { signIn, user, role, roleChecked, loading, isFirstLogin } = useAuth();

  useEffect(() => {
    const cached = getCachedBranding();
    if (cached) {
      if (cached.logoUrl) setCachedLogo(cached.logoUrl);
      if (cached.displayName) setCachedName(cached.displayName);
    }
  }, []);

  useEffect(() => {
    if (submitting) return;

    if (!loading && user && roleChecked && role) {
      if (role === "super_admin") {
        navigate("/super-admin", { replace: true });
      } else if (role === "admin" || role === "moderator") {
        navigate("/admin", { replace: true });
      } else if (role === "client") {
        if (isFirstLogin) {
          navigate("/gestante/alterar-senha", { replace: true });
        } else {
          navigate("/gestante", { replace: true });
        }
      }
    }
  }, [loading, user, role, roleChecked, isFirstLogin, navigate, submitting]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    if (!email || !password) {
      toast.error("Preencha todos os campos");
      setSubmitting(false);
      return;
    }

    const loginIdentifier = email.trim().toLowerCase();
    const { error } = await signIn(loginIdentifier, password);

    if (error) {
      toast.error("Erro ao fazer login", {
        description: "Credenciais incorretas. Verifique e tente novamente.",
      });
      setSubmitting(false);
      return;
    }

    rememberLastLoginIdentifier(loginIdentifier);

    await promptToSavePassword({
      form: formRef.current,
      loginId: loginIdentifier,
      password,
    });

    toast.success("Login realizado com sucesso!");
    setSubmitting(false);
  };

  if (loading && !submitting) {
    return (
      <div className="fixed inset-0 safe-area-top safe-area-bottom flex items-center justify-center bg-background overflow-hidden">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitting && user && !roleChecked) {
    return (
      <div className="fixed inset-0 safe-area-top safe-area-bottom flex items-center justify-center bg-background overflow-hidden">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (user && roleChecked && role) {
    return (
      <div className="fixed inset-0 safe-area-top safe-area-bottom flex items-center justify-center bg-background overflow-hidden">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 safe-area-top safe-area-bottom flex items-center justify-center bg-background p-4 overflow-hidden">
      <Card className="w-full max-w-md max-h-[calc(100dvh-2rem-var(--app-safe-top)-var(--app-safe-bottom))] overflow-y-auto card-glass">
        <CardHeader className="text-center space-y-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={cachedLogo || logo} alt={cachedName || "Doula Care"} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-2xl font-display font-bold tracking-wide">{cachedName || "Doula Care"}</CardTitle>
          </div>
          <CardDescription>Entre com seu usuário ou email e senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} action="/login" method="post" autoComplete="on" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário ou Email</Label>
              <Input
                id="username"
                name="username"
                type="text"
                inputMode="text"
                enterKeyHint="next"
                placeholder="usuário ou email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="input-field lowercase"
                style={{ textTransform: "lowercase" }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
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
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-2">
            <div>
              É doula?{" "}
              <Link to="/cadastro" className="text-primary hover:underline font-medium">
                Crie sua conta
              </Link>
            </div>
            <div>
              Já tem a sua doula?{" "}
              <Link to="/recuperar-acesso" className="text-primary hover:underline font-medium">
                Clique aqui
              </Link>
            </div>
            <div className="mt-2">
              <Link to="/politica-de-privacidade" className="text-xs text-muted-foreground/70 hover:text-primary hover:underline">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
