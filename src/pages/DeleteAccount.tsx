import { useState } from "react";
import { ArrowLeft, Trash2, Loader2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UserType = "gestante" | "doula";

export default function DeleteAccount() {
  const [userType, setUserType] = useState<UserType>("gestante");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!identifier.trim() || !password.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Build login email based on user type
      let loginEmail = identifier.trim();
      if (userType === "gestante" && !loginEmail.includes("@")) {
        loginEmail = `${loginEmail}@gestante.doula.app`;
      }

      // Attempt authentication to validate credentials
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (signInError) {
        setAuthError(
          userType === "gestante"
            ? "Usuário ou senha inválidos. Verifique suas credenciais."
            : "E-mail ou senha inválidos. Verifique suas credenciais."
        );
        setLoading(false);
        return;
      }

      const userEmail = data.user?.email || loginEmail;

      // Sign out immediately after validation
      await supabase.auth.signOut({ scope: "local" });

      // Now submit the deletion request with validated email
      await supabase.functions.invoke("request-account-deletion", {
        body: { email: userEmail, reason: reason.trim() },
      });

      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Solicitação Recebida</h2>
            <p className="text-sm text-muted-foreground">
              Sua solicitação de exclusão de conta e dados foi registrada. O processo será
              concluído em até <strong>30 dias úteis</strong>. Você receberá uma confirmação
              no e-mail informado.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4">
                Voltar ao login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <Link
          to="/politica-de-privacidade"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar à Política de Privacidade
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Solicitar Exclusão de Conta e Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Para confirmar a exclusão, faça login com suas credenciais. <strong>Todos os seus dados</strong> serão permanentemente
              removidos, incluindo: perfil, diário gestacional, registros de contrações,
              agendamentos, pagamentos e notificações. Esta ação é <strong>irreversível</strong>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Label>Tipo de conta</Label>
                <RadioGroup
                  value={userType}
                  onValueChange={(v) => {
                    setUserType(v as UserType);
                    setIdentifier("");
                    setAuthError("");
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gestante" id="type-gestante" />
                    <Label htmlFor="type-gestante" className="cursor-pointer font-normal">
                      Gestante / Cliente
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="doula" id="type-doula" />
                    <Label htmlFor="type-doula" className="cursor-pointer font-normal">
                      Doula / Profissional
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">
                  {userType === "gestante" ? "Usuário *" : "E-mail *"}
                </Label>
                <Input
                  id="identifier"
                  type={userType === "doula" ? "email" : "text"}
                  placeholder={userType === "gestante" ? "nome.sobrenome" : "seu@email.com"}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setAuthError("");
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError("");
                  }}
                  required
                />
              </div>

              {authError && (
                <p className="text-sm text-destructive font-medium">{authError}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Conte-nos por que deseja excluir sua conta..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Confirmar e Solicitar Exclusão
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
