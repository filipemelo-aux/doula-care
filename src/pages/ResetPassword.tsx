import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCachedBranding } from "@/hooks/useOrgBranding";

type Status = "validating" | "ready" | "invalid" | "done";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("validating");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedBranding();
    if (cached) {
      if (cached.logoUrl) setCachedLogo(cached.logoUrl);
      if (cached.displayName) setCachedName(cached.displayName);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setStatus("ready");
    });

    const validate = async () => {
      const hash = window.location.hash || "";
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");

      // PKCE flow: exchange the code for a recovery session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        setStatus(error ? "invalid" : "ready");
        return;
      }

      // Implicit flow: tokens arrive in the URL hash and are picked up by the client
      if (hash.includes("access_token")) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setStatus(data.session ? "ready" : "invalid");
        return;
      }

      if (hash.includes("error") || search.get("error")) {
        if (active) setStatus("invalid");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setStatus(data.session ? "ready" : "invalid");
    };

    validate();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível alterar a senha", { description: error.message });
      return;
    }

    setStatus("done");
    toast.success("Senha alterada com sucesso!");
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login", { replace: true }), 800);
  };

  return (
    <div className="h-[100dvh] overflow-y-auto flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={cachedLogo || logo} alt={cachedName || "Doula Care"} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-2xl font-display font-bold tracking-wide">{cachedName || "Doula Care"}</CardTitle>
          </div>
          <CardDescription>Crie sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "validating" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando seu link...</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Este link de recuperação é inválido ou já expirou. Solicite um novo para continuar.
              </p>
              <Button asChild className="w-full">
                <Link to="/esqueci-senha">Solicitar novo link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          )}

          {status === "done" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Senha atualizada. Entre novamente com a sua nova senha.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
                <Label htmlFor="confirm-password">Confirme a nova senha</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="input-field"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
