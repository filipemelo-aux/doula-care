import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { label: "Acesso", short: "Acesso" },
  { label: "Dados pessoais", short: "Pessoal" },
  { label: "Endereço", short: "Endereço" },
  { label: "Gestação", short: "Gestação" },
  { label: "Saúde", short: "Saúde" },
  { label: "Apoio", short: "Apoio" },
];

export default function RegisterVisitor() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 0 — credenciais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1 — pessoais
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  // Step 2 — endereço
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Step 3 — gestação
  const [status, setStatus] = useState<"gestante" | "tentante" | "lactante" | "outro">("gestante");
  const [dpp, setDpp] = useState("");
  const [pregnancyWeeks, setPregnancyWeeks] = useState<string>("");
  const [birthLocation, setBirthLocation] = useState("");

  // Step 4 — saúde
  const [prenatalHighRisk, setPrenatalHighRisk] = useState(false);
  const [prenatalType, setPrenatalType] = useState("");
  const [comorbidades, setComorbidades] = useState("");
  const [alergias, setAlergias] = useState("");
  const [restricaoAromaterapia, setRestricaoAromaterapia] = useState("");

  // Step 5 — apoio / redes
  const [companionName, setCompanionName] = useState("");
  const [companionPhone, setCompanionPhone] = useState("");
  const [hasFotografa, setHasFotografa] = useState(false);
  const [fotografaName, setFotografaName] = useState("");
  const [fotografaPhone, setFotografaPhone] = useState("");
  const [instagramGestante, setInstagramGestante] = useState("");
  const [instagramAcompanhante, setInstagramAcompanhante] = useState("");

  // ViaCEP autofill
  useEffect(() => {
    const digits = zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then(r => r.json())
      .then(d => {
        if (d?.erro) return;
        setStreet(d.logradouro || "");
        setNeighborhood(d.bairro || "");
        setCity(d.localidade || "");
        setState(d.uf || "");
      })
      .catch(() => {});
  }, [zipCode]);

  // Geolocation: derived from city/state via Nominatim
  useEffect(() => {
    if (!city || !state) return;
    const ctrl = new AbortController();
    const url = `https://nominatim.openstreetmap.org/search?format=json&country=Brazil&state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&limit=1`;
    fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .then(r => r.json())
      .then(arr => {
        if (Array.isArray(arr) && arr[0]) {
          setLatitude(parseFloat(arr[0].lat));
          setLongitude(parseFloat(arr[0].lon));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [city, state]);

  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (!email.trim() || !password) { toast.error("Preencha email e senha"); return false; }
        if (password.length < 6) { toast.error("Senha mínima de 6 caracteres"); return false; }
        if (password !== confirmPassword) { toast.error("Senhas não coincidem"); return false; }
        return true;
      case 1:
        if (!fullName.trim() || !phone.trim()) { toast.error("Nome e telefone são obrigatórios"); return false; }
        return true;
      case 2:
        if (!city.trim() || !state.trim()) { toast.error("Informe ao menos cidade e estado para encontrarmos doulas perto de você"); return false; }
        return true;
      default:
        return true;
    }
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(5, (s + 1)) as Step); };
  const prev = () => setStep(s => Math.max(0, s - 1) as Step);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-visitor", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          preferredName: preferredName.trim() || null,
          phone,
          cpf: cpf || null,
          street, number, neighborhood, city, state, zip_code: zipCode,
          latitude, longitude,
          status,
          dpp: dpp || null,
          pregnancy_weeks: pregnancyWeeks ? parseInt(pregnancyWeeks) : null,
          birth_location: birthLocation || null,
          prenatal_high_risk: prenatalHighRisk,
          prenatal_type: prenatalType || null,
          comorbidades: comorbidades || null,
          alergias: alergias || null,
          restricao_aromaterapia: restricaoAromaterapia || null,
          companion_name: companionName || null,
          companion_phone: companionPhone || null,
          has_fotografa: hasFotografa,
          fotografa_name: fotografaName || null,
          fotografa_phone: fotografaPhone || null,
          instagram_gestante: instagramGestante || null,
          instagram_acompanhante: instagramAcompanhante || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("Cadastro concluído!", { description: "Faça login para encontrar sua doula." });
      navigate("/login");
    } catch (err: any) {
      toast.error("Erro ao cadastrar", { description: err?.message || "Tente novamente" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] safe-area-top safe-area-bottom flex items-start sm:items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-2xl card-glass">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-xl font-display tracking-wide">Cadastro de visitante</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Crie sua conta gratuita e encontre uma doula perto de você
          </CardDescription>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-1 pt-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors",
                  i < step && "bg-primary text-primary-foreground",
                  i === step && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  i > step && "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="text-[9px] text-muted-foreground hidden sm:block">{s.short}</span>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="input-field lowercase" style={{ textTransform: "lowercase" }} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="input-field pr-10" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmar senha</Label>
                <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className="input-field" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Maria da Silva" mask="name" className="input-field" />
              </div>
              <div className="space-y-2">
                <Label>Como prefere ser chamada?</Label>
                <Input value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="Maria" mask="name" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 91234-5678" mask="phone" className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" mask="cpf" className="input-field" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="00000-000" mask="cep" className="input-field" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Rua</Label>
                  <Input value={street} onChange={e => setStreet(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={number} onChange={e => setNumber(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Bairro</Label>
                  <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <Label>Cidade *</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>UF *</Label>
                  <Input value={state} onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))} className="input-field w-16 text-center" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sua localização nos ajuda a mostrar doulas próximas. Você poderá ajustar depois.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Sua situação atual *</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="input-field"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tentante">Tentante</SelectItem>
                    <SelectItem value="gestante">Gestante</SelectItem>
                    <SelectItem value="lactante">Puérpera / Lactante</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === "gestante" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Semanas atuais</Label>
                      <Input type="number" min={0} max={42} value={pregnancyWeeks} onChange={e => setPregnancyWeeks(e.target.value)} className="input-field" />
                    </div>
                    <div className="space-y-2">
                      <Label>DPP (data provável)</Label>
                      <Input type="date" value={dpp} onChange={e => setDpp(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Local previsto do parto</Label>
                    <Input value={birthLocation} onChange={e => setBirthLocation(e.target.value)} placeholder="Hospital, casa..." className="input-field" />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Pré-natal de alto risco?</p>
                  <p className="text-xs text-muted-foreground">Marque se foi orientada por médico</p>
                </div>
                <Switch checked={prenatalHighRisk} onCheckedChange={setPrenatalHighRisk} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de pré-natal</Label>
                <Input value={prenatalType} onChange={e => setPrenatalType(e.target.value)} placeholder="Ex: SUS, particular, convênio" className="input-field" />
              </div>
              <div className="space-y-2">
                <Label>Comorbidades</Label>
                <Textarea value={comorbidades} onChange={e => setComorbidades(e.target.value)} placeholder="Ex: hipertensão, diabetes..." className="input-field min-h-[60px]" />
              </div>
              <div className="space-y-2">
                <Label>Alergias</Label>
                <Textarea value={alergias} onChange={e => setAlergias(e.target.value)} placeholder="Medicamentos, alimentos..." className="input-field min-h-[60px]" />
              </div>
              <div className="space-y-2">
                <Label>Restrições à aromaterapia</Label>
                <Input value={restricaoAromaterapia} onChange={e => setRestricaoAromaterapia(e.target.value)} className="input-field" />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Acompanhante</Label>
                  <Input value={companionName} onChange={e => setCompanionName(e.target.value)} mask="name" className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={companionPhone} onChange={e => setCompanionPhone(e.target.value)} mask="phone" className="input-field" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium">Tem fotógrafa contratada?</p>
                <Switch checked={hasFotografa} onCheckedChange={setHasFotografa} />
              </div>
              {hasFotografa && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Fotógrafa</Label>
                    <Input value={fotografaName} onChange={e => setFotografaName(e.target.value)} mask="name" className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={fotografaPhone} onChange={e => setFotografaPhone(e.target.value)} mask="phone" className="input-field" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Instagram da gestante</Label>
                  <Input value={instagramGestante} onChange={e => setInstagramGestante(e.target.value)} placeholder="@usuaria" className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>Instagram do(a) acompanhante</Label>
                  <Input value={instagramAcompanhante} onChange={e => setInstagramAcompanhante(e.target.value)} placeholder="@usuario" className="input-field" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={prev} disabled={step === 0 || submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < 5 ? (
              <Button type="button" onClick={next} disabled={submitting}>
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cadastrando...</> : "Concluir cadastro"}
              </Button>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2">
            Já tem conta? <Link to="/login" className="text-primary hover:underline font-medium">Fazer login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
