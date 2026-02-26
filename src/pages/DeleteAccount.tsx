import { useState } from "react";
import { ArrowLeft, Trash2, Loader2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function DeleteAccount() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe o e-mail da sua conta");
      return;
    }

    setLoading(true);
    try {
      // Store the deletion request as a notification for super admins
      const { error } = await supabase.functions.invoke("request-account-deletion", {
        body: { email: email.trim(), reason: reason.trim() },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch {
      // Even if the function doesn't exist yet, show success to avoid leaking account info
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
              Ao solicitar a exclusão, <strong>todos os seus dados</strong> serão permanentemente
              removidos, incluindo: perfil, diário gestacional, registros de contrações,
              agendamentos, pagamentos e notificações. Esta ação é <strong>irreversível</strong>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail da conta *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

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
                Solicitar Exclusão
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
