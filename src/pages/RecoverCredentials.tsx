import { useState } from "react";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { maskCPF } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { getCachedBranding } from "@/hooks/useOrgBranding";
import { useEffect } from "react";

interface RecoveryResult {
  found: boolean;
  alreadyChanged: boolean;
  username: string;
  password?: string;
  message?: string;
}

export default function RecoverCredentials() {
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedBranding();
    if (cached) {
      if (cached.logoUrl) setCachedLogo(cached.logoUrl);
      if (cached.displayName) setCachedName(cached.displayName);
    }
  }, []);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    if (!fullName.trim() || !cpf.trim()) {
      toast.error("Preencha todos os campos");
      setSubmitting(false);
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF inválido");
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("recover-client-credentials", {
        body: { fullName: fullName.trim(), cpf: cleanCpf },
      });

      if (error) {
        toast.error("Erro ao buscar credenciais");
        setSubmitting(false);
        return;
      }

      if (data.error) {
        toast.error(data.error);
        setSubmitting(false);
        return;
      }

      setResult(data);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={cachedLogo || logo} alt={cachedName || "Doula Care"} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-2xl font-display font-bold tracking-wide">{cachedName || "Doula Care"}</CardTitle>
          </div>
          <CardDescription>
            {result ? "Suas credenciais de acesso" : "Recupere suas credenciais de acesso"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  required
                  maxLength={14}
                  className="input-field"
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  "Buscar minhas credenciais"
                )}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {result.alreadyChanged ? (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Seu usuário</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono flex-1 break-all">{result.username}</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleCopy(result.username, "user")}
                        >
                          {copiedField === "user" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {result.message}
                  </p>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Seu usuário</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1 break-all">{result.username}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleCopy(result.username, "user")}
                      >
                        {copiedField === "user" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Sua senha</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1">
                        {showPassword ? result.password : "••••••"}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleCopy(result.password!, "pass")}
                      >
                        {copiedField === "pass" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/login">Ir para o login</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setResult(null); setFullName(""); setCpf(""); setShowPassword(false); }}
                >
                  Buscar novamente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
