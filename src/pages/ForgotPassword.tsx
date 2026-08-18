import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCachedBranding } from "@/hooks/useOrgBranding";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedBranding();
    if (cached) {
      if (cached.logoUrl) setCachedLogo(cached.logoUrl);
      if (cached.displayName) setCachedName(cached.displayName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();

    if (!value) {
      toast.error("Informe seu e-mail");
      return;
    }

    if (!value.includes("@")) {
      toast.error("Digite um e-mail válido", {
        description: "Se você é cliente de uma doula, use a opção \"Já tem a sua doula?\" na tela de login.",
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setSubmitting(false);

    if (error) {
      const message = error.message?.toLowerCase() || "";
      if (message.includes("rate") || (error as { status?: number }).status === 429) {
        toast.error("Muitas tentativas", {
          description: "Aguarde alguns minutos antes de solicitar um novo e-mail.",
        });
        return;
      }
      toast.error("Não foi possível enviar o e-mail", {
        description: "Tente novamente em instantes.",
      });
      return;
    }

    setSent(true);
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
          <CardDescription>
            {sent ? "Verifique seu e-mail" : "Recupere o acesso à sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 flex flex-col items-center text-center gap-2">
                <MailCheck className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. O link vale por
                  tempo limitado — confira também a caixa de spam.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setSent(false)}>
                Enviar novamente
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail da conta</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="input-field lowercase"
                  style={{ textTransform: "lowercase" }}
                />
                <p className="text-xs text-muted-foreground">
                  Use o e-mail cadastrado da sua conta de doula ou de membro da equipe.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
              <div className="text-center space-y-2">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </Link>
                <div className="text-xs text-muted-foreground">
                  É cliente de uma doula?{" "}
                  <Link to="/recuperar-acesso" className="text-primary hover:underline font-medium">
                    Recupere seu acesso aqui
                  </Link>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
