import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/logo.png";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAddressByCep } from "@/lib/address";
import { unmask } from "@/lib/masks";
import { AvatarUpload } from "@/components/gestante/AvatarUpload";

export const CONSENT_VERSION = "2026-09-lgpd-v1";

const TOTAL_STEPS = 6;

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Etapa 1/2 — e-mail verificado
  const [email, setEmail] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);
  const [code, setCode] = useState("");
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Etapa 3 — dados pessoais
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Etapa 4 — contato e endereço
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Etapa 5 — dados profissionais
  const [doulaTraining, setDoulaTraining] = useState("");
  const [practiceSince, setPracticeSince] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Etapa 6 — consentimento
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTruth, setAcceptTruth] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    const digits = unmask(postalCode);
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetchAddressByCep(digits)
      .then((addr) => {
        if (cancelled || !addr) return;
        setStreet(addr.street || "");
        setNeighborhood(addr.neighborhood || "");
        setCity(addr.city || "");
        setUf((addr.state || "").toUpperCase());
      })
      .finally(() => !cancelled && setCepLoading(false));
    return () => {
      cancelled = true;
    };
  }, [postalCode]);

  const sendCode = async () => {
    if (!email.trim()) {
      toast.error("Informe seu e-mail profissional");
      return;
    }
    setEmailTaken(false);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-signup-code", {
        body: { email: email.trim().toLowerCase() },
      });
      let serverMessage: string | null = data?.error ?? null;
      // Em respostas 4xx/5xx o invoke devolve apenas `error`; é preciso ler o corpo.
      if (error && !serverMessage) {
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json().catch(() => null);
            serverMessage = body?.error ?? null;
          }
        } catch {
          /* sem corpo legível */
        }
      }
      if (error || serverMessage) {
        const msg = serverMessage || "Não foi possível enviar o código";
        if (/já está cadastrado|já possui uma conta/i.test(msg)) {
          setEmailTaken(true);
        }
        toast.error(msg);
        return;
      }
      toast.success("Código enviado!", { description: "Confira sua caixa de entrada e o spam." });
      setResendIn(60);
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      toast.error("Digite os 6 dígitos do código");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error || !data.user) {
        toast.error("Código inválido ou expirado");
        return;
      }
      setVerifiedUserId(data.user.id);
      toast.success("E-mail verificado!");
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  const validPersonal = useMemo(() => {
    return (
      fullName.trim().includes(" ") &&
      unmask(cpf).length === 11 &&
      !!birthDate &&
      password.length >= 6 &&
      password === confirmPassword
    );
  }, [fullName, cpf, birthDate, password, confirmPassword]);

  const validContact =
    unmask(whatsapp).length >= 10 &&
    instagram.trim().replace(/^@/, "").length >= 2 &&
    unmask(postalCode).length === 8 &&
    !!city.trim() &&
    uf.trim().length === 2 &&
    !!street.trim() &&
    !!streetNumber.trim();

  const validProfessional =
    doulaTraining.trim().length >= 2 &&
    /^\d{4}$/.test(practiceSince) &&
    Number(practiceSince) >= 1970 &&
    Number(practiceSince) <= new Date().getFullYear();

  const finish = async () => {
    if (!acceptPrivacy || !acceptTruth) {
      toast.error("É preciso aceitar os termos para concluir");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-doula", {
        body: {
          fullName: fullName.trim(),
          password,
          cpf: unmask(cpf),
          birthDate,
          whatsapp,
          instagram: instagram.trim().replace(/^@/, ""),
          postalCode: unmask(postalCode),
          street: street.trim(),
          streetNumber: streetNumber.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: uf.trim().toUpperCase(),
          doulaTraining: doulaTraining.trim(),
          practiceSince: Number(practiceSince),
          bio: bio.trim(),
          serviceAreas: city.trim() ? [city.trim()] : [],
          avatarUrl,
          consentVersion: CONSENT_VERSION,
        },
      });

      if (error || data?.error) {
        toast.error("Erro ao criar conta", { description: data?.error || error?.message });
        return;
      }

      await supabase.auth.signOut();
      toast.success("Cadastro concluído!", {
        description: "Faça login com seu e-mail e senha para começar.",
      });
      navigate("/login");
    } catch {
      toast.error("Erro inesperado ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto flex items-start sm:items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 py-8">
      <Card className="w-full max-w-md card-glass">
        <CardHeader className="text-center space-y-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-2xl font-display font-bold tracking-wide">Doula Care</CardTitle>
          </div>
          <CardDescription>Crie sua conta profissional</CardDescription>
          <div className="flex gap-1.5 justify-center pt-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 <= step ? "w-6 bg-primary" : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail profissional</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTaken(false);
                  }}
                  autoComplete="email"
                  className="input-field lowercase"
                  style={{ textTransform: "lowercase" }}
                />
                {emailTaken ? (
                  <p className="text-xs font-medium text-destructive">
                    Este e-mail já possui cadastro.{" "}
                    <Link to="/login" className="underline">
                      Faça login
                    </Link>{" "}
                    ou{" "}
                    <Link to="/esqueci-senha" className="underline">
                      recupere sua senha
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enviaremos um código de 6 dígitos para confirmar que o e-mail é seu.
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={sendCode} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar código
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col items-center text-center gap-2">
                <MailCheck className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Digite o código enviado para <strong>{email}</strong>
                </p>
              </div>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input-field text-center text-2xl tracking-[0.5em]"
              />
              <Button className="w-full" onClick={verifyCode} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verificar código
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setStep(1)}>
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Trocar e-mail
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-50"
                  disabled={resendIn > 0 || submitting}
                  onClick={sendCode}
                >
                  {resendIn > 0 ? `Reenviar em ${resendIn}s` : "Reenviar código"}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" mask="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" placeholder="Seu nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" mask="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} className="input-field" placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Nascimento</Label>
                  <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-10"
                    autoComplete="new-password"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" autoComplete="new-password" />
              </div>
              <Button className="w-full" onClick={() => setStep(4)} disabled={!validPersonal}>
                Continuar
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" mask="phone" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="input-field" placeholder="(11) 90000-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, "").toLowerCase())} className="input-field" placeholder="@seuperfil" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="relative">
                    <Input id="cep" mask="cep" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-field" placeholder="00000-000" />
                    {cepLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Endereço</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={city} onChange={(e) => setCity(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="uf">UF</Label>
                  <Input id="uf" mask="uppercase" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Voltar</Button>
                <Button className="flex-1" onClick={() => setStep(5)} disabled={!validContact}>Continuar</Button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="flex justify-center">
                <AvatarUpload
                  currentUrl={avatarUrl}
                  onUploaded={setAvatarUrl}
                  userId={verifiedUserId ?? undefined}
                  name={fullName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training">Formação / curso de doula</Label>
                <Input id="training" value={doulaTraining} onChange={(e) => setDoulaTraining(e.target.value)} className="input-field" placeholder="Ex.: Curso de Doulas GAMA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="since">Atua como doula desde (ano)</Label>
                <Input id="since" inputMode="numeric" maxLength={4} value={practiceSince} onChange={(e) => setPracticeSince(e.target.value.replace(/\D/g, "").slice(0, 4))} className="input-field" placeholder="2020" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Apresentação (opcional)</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Conte um pouco sobre o seu trabalho" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Voltar</Button>
                <Button className="flex-1" onClick={() => setStep(6)} disabled={!validProfessional}>Continuar</Button>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <div className="rounded-2xl bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Privacidade dos seus dados
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Usamos seus dados apenas para identificar você como profissional, manter a
                  segurança da comunidade e permitir que gestantes encontrem doulas na sua região.
                  CPF e data de nascimento ficam visíveis somente para você e para a equipe
                  responsável pela plataforma — nunca para outras doulas, clientes ou colaboradoras.
                  Você pode solicitar correção ou exclusão dos seus dados a qualquer momento.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={acceptPrivacy} onCheckedChange={(v) => setAcceptPrivacy(v === true)} />
                <span>
                  Li e aceito a{" "}
                  <Link to="/politica-de-privacidade" className="text-primary hover:underline" target="_blank">
                    Política de Privacidade
                  </Link>{" "}
                  e autorizo o tratamento dos meus dados.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={acceptTruth} onCheckedChange={(v) => setAcceptTruth(v === true)} />
                <span>Confirmo que as informações fornecidas são verdadeiras e que atuo como doula.</span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(5)} disabled={submitting}>Voltar</Button>
                <Button className="flex-1" onClick={finish} disabled={submitting || !acceptPrivacy || !acceptTruth}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Concluir cadastro
                </Button>
              </div>
            </>
          )}

          <div className="pt-2 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
