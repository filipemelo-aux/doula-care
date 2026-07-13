import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export default function RegisterVisitor() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Acesso
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Pessoais
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  // Endereço
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Gestação
  const [status, setStatus] = useState<"gestante" | "tentante" | "lactante" | "outro">("gestante");
  const [dpp, setDpp] = useState("");
  const [pregnancyWeeks, setPregnancyWeeks] = useState<string>("");
  const [birthLocation, setBirthLocation] = useState("");

  // Saúde
  const [prenatalHighRisk, setPrenatalHighRisk] = useState(false);
  const [prenatalType, setPrenatalType] = useState("");
  const [comorbidades, setComorbidades] = useState("");
  const [alergias, setAlergias] = useState("");
  const [restricaoAromaterapia, setRestricaoAromaterapia] = useState("");

  // Apoio
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

  // Geolocalização derivada de cidade/UF
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) { toast.error("Preencha email e senha"); return; }
    if (password.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    if (password !== confirmPassword) { toast.error("Senhas não coincidem"); return; }
    if (!fullName.trim() || !phone.trim()) { toast.error("Nome e telefone são obrigatórios"); return; }
    if (!city.trim() || !state.trim()) { toast.error("Informe ao menos cidade e estado para encontrarmos doulas perto de você"); return; }

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
          restricoes_assistencia: {
            alergias: alergias || null,
            restricoes: null,
            fobias_gatilhos: null,
            condicoes_especiais: null,
          },
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

      // Gerar username no padrão nome.sobrenome (igual ao cadastro feito pelo admin)
      const parts = fullName
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const username = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || "";

      toast.success("Cadastro concluído!", {
        description: username
          ? `Seu usuário de acesso é "${username}". Use ele ou seu email para entrar.`
          : "Faça login para encontrar sua doula.",
        duration: 7000,
      });
      navigate("/login");
    } catch (err: any) {
      toast.error("Erro ao cadastrar", { description: err?.message || "Tente novamente" });
    } finally {
      setSubmitting(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="pt-2">
      <h3 className="text-sm font-semibold text-foreground/90">{children}</h3>
      <div className="h-px bg-border/60 mt-2" />
    </div>
  );

  return (
    <div className="h-[100dvh] overflow-y-auto safe-area-top flex items-start justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-32 md:pb-8" style={{ paddingBottom: 'max(8rem, env(safe-area-inset-bottom) + 6rem)' }}>
      <Card className="w-full max-w-2xl card-glass">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <CardTitle className="text-xl font-display tracking-wide">Cadastro de visitante</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Crie sua conta gratuita e encontre uma doula perto de você
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Acesso */}
            <SectionTitle>Acesso</SectionTitle>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="input-field lowercase" style={{ textTransform: "lowercase" }} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="input-field pr-10" required minLength={6} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha *</Label>
                  <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className="input-field" required minLength={6} />
                </div>
              </div>
            </div>

            {/* Pessoais */}
            <SectionTitle>Dados pessoais</SectionTitle>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Maria da Silva" mask="name" className="input-field" required />
              </div>
              <div className="space-y-2">
                <Label>Como prefere ser chamada?</Label>
                <Input value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="Maria" mask="name" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 91234-5678" mask="phone" className="input-field" required />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" mask="cpf" className="input-field" />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <SectionTitle>Endereço</SectionTitle>
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
                  <Input value={city} onChange={e => setCity(e.target.value)} className="input-field" required />
                </div>
                <div className="space-y-2">
                  <Label>UF *</Label>
                  <Input value={state} onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))} className="input-field w-16 text-center" required />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sua localização nos ajuda a mostrar doulas próximas.
              </p>
            </div>

            {/* Gestação */}
            <SectionTitle>Gestação e pré-natal</SectionTitle>
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

            {/* Saúde */}
            <SectionTitle>Saúde e restrições</SectionTitle>
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

            {/* Apoio */}
            <SectionTitle>Rede de apoio</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Acompanhante</Label>
                  <Input value={companionName} onChange={e => setCompanionName(e.target.value)} mask="name" className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
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
                    <Label>WhatsApp</Label>
                    <Input value={fotografaPhone} onChange={e => setFotografaPhone(e.target.value)} mask="phone" className="input-field" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Instagram (gestante)</Label>
                  <Input value={instagramGestante} onChange={e => setInstagramGestante(e.target.value)} placeholder="@maria" className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label>Instagram (acompanhante)</Label>
                  <Input value={instagramAcompanhante} onChange={e => setInstagramAcompanhante(e.target.value)} placeholder="@joao" className="input-field" />
                </div>
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando conta...</>
                ) : (
                  "Concluir cadastro"
                )}
              </Button>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">Fazer login</Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
