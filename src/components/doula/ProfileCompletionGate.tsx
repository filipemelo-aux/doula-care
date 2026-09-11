import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAddressByCep } from "@/lib/address";
import { unmask } from "@/lib/masks";
import { AvatarUpload } from "@/components/gestante/AvatarUpload";
import { CONSENT_VERSION } from "@/pages/Register";

/**
 * Formulário obrigatório de atualização cadastral para doulas antigas.
 * Aparece uma única vez: assim que o cadastro é concluído, `profile_completed_at`
 * é preenchido e o formulário nunca mais é exibido, em nenhum dispositivo.
 * Não pode ser cancelado nem fechado — se a doula fechar o app, ele volta a abrir.
 */
export function ProfileCompletionGate() {
  const { user, role, organizationId, profileName } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [doulaTraining, setDoulaTraining] = useState("");
  const [practiceSince, setPracticeSince] = useState("");
  const [bio, setBio] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  // 1. Verifica pendência
  useEffect(() => {
    if (!user || role !== "admin" || !organizationId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [{ data: profile }, { data: org }, { data: personal }] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url, profile_completed_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("whatsapp, instagram, postal_code, street, street_number, neighborhood, city, state, bio, doula_training, practice_since")
          .eq("id", organizationId)
          .maybeSingle(),
        supabase
          .from("doula_personal_data")
          .select("cpf, birth_date")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setLoading(false);

      if ((profile as any)?.profile_completed_at) return;

      setAvatarUrl((profile as any)?.avatar_url ?? null);
      setWhatsapp((org as any)?.whatsapp ?? "");
      setInstagram(((org as any)?.instagram ?? "").replace(/^@/, ""));
      setPostalCode((org as any)?.postal_code ?? "");
      initialCepRef.current = unmask(String((org as any)?.postal_code ?? ""));

      setStreet((org as any)?.street ?? "");
      setStreetNumber((org as any)?.street_number ?? "");
      setNeighborhood((org as any)?.neighborhood ?? "");
      setCity((org as any)?.city ?? "");
      setUf(((org as any)?.state ?? "").toUpperCase());
      setBio((org as any)?.bio ?? "");
      setDoulaTraining((org as any)?.doula_training ?? "");
      setPracticeSince((org as any)?.practice_since ? String((org as any).practice_since) : "");
      setCpf((personal as any)?.cpf ?? "");
      setBirthDate((personal as any)?.birth_date ?? "");
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, role, organizationId]);

  // 2. CEP → endereço (sobrescreve ao trocar o CEP, exceto no carregamento inicial)
  const initialCepRef = useRef<string | null>(null);
  useEffect(() => {
    const digits = unmask(postalCode);
    if (digits.length !== 8) return;
    if (initialCepRef.current === null) {
      // primeiro CEP vindo do cadastro existente: não sobrescreve o que já está salvo
      initialCepRef.current = digits;
      return;
    }
    if (initialCepRef.current === digits) return;
    initialCepRef.current = digits;
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


  const validStep1 = useMemo(
    () =>
      unmask(cpf).length === 11 &&
      !!birthDate &&
      unmask(whatsapp).length >= 10 &&
      instagram.trim().replace(/^@/, "").length >= 2,
    [cpf, birthDate, whatsapp, instagram]
  );

  const validStep2 =
    unmask(postalCode).length === 8 &&
    !!street.trim() &&
    !!streetNumber.trim() &&
    !!city.trim() &&
    uf.trim().length === 2;

  const validStep3 =
    doulaTraining.trim().length >= 2 &&
    /^\d{4}$/.test(practiceSince) &&
    Number(practiceSince) >= 1970 &&
    Number(practiceSince) <= new Date().getFullYear() &&
    acceptPrivacy;

  const save = async () => {
    if (!user || !organizationId) return;
    setSaving(true);
    try {
      const { error: personalError } = await supabase
        .from("doula_personal_data")
        .upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            cpf: unmask(cpf),
            birth_date: birthDate,
          } as any,
          { onConflict: "user_id" }
        );
      if (personalError) throw personalError;

      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          whatsapp,
          instagram: instagram.trim().replace(/^@/, ""),
          postal_code: unmask(postalCode),
          street: street.trim(),
          street_number: streetNumber.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: uf.trim().toUpperCase(),
          bio: bio.trim() || null,
          doula_training: doulaTraining.trim(),
          practice_since: Number(practiceSince),
        } as any)
        .eq("id", organizationId);
      if (orgError) throw orgError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          lgpd_consent_at: new Date().toISOString(),
          lgpd_consent_version: CONSENT_VERSION,
          profile_completed_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      toast.success("Cadastro atualizado. Obrigado!");
      setOpen(false);
    } catch (err: any) {
      console.error("Profile completion error:", err);
      toast.error("Não foi possível salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md bg-card rounded-[18px] shadow-xl p-5 max-h-[92dvh] overflow-y-auto">
        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display font-bold text-xl">
              {profileName ? `${profileName.split(" ")[0]}, ` : ""}vamos completar seu cadastro?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos reforçando a segurança da plataforma para garantir que só doulas reais
              tenham acesso às gestantes. Leva menos de 2 minutos e é necessário apenas uma vez.
            </p>
          </div>

          <div className="flex gap-1.5 justify-center">
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? "w-6 bg-primary" : "w-3 bg-muted"}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <AvatarUpload currentUrl={avatarUrl} onUploaded={setAvatarUrl} userId={user?.id} name={profileName ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="g-cpf">CPF</Label>
                  <Input id="g-cpf" mask="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} className="input-field" placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-birth">Nascimento</Label>
                  <Input id="g-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="g-wpp">WhatsApp</Label>
                  <Input id="g-wpp" mask="phone" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="input-field" placeholder="(11) 90000-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-insta">Instagram</Label>
                  <Input id="g-insta" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, "").toLowerCase())} className="input-field" placeholder="@seuperfil" />
                </div>
              </div>
              <Button className="w-full" disabled={!validStep1} onClick={() => setStep(2)}>Continuar</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="g-cep">CEP</Label>
                  <div className="relative">
                    <Input id="g-cep" mask="cep" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-field" placeholder="00000-000" />
                    {cepLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-num">Número</Label>
                  <Input id="g-num" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-street">Endereço</Label>
                <Input id="g-street" value={street} onChange={(e) => setStreet(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="g-bairro">Bairro</Label>
                  <Input id="g-bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-cidade">Cidade</Label>
                  <Input id="g-cidade" value={city} onChange={(e) => setCity(e.target.value)} className="input-field" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-uf">UF</Label>
                  <Input id="g-uf" mask="uppercase" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
                <Button className="flex-1" disabled={!validStep2} onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="g-training">Formação / curso de doula</Label>
                <Input id="g-training" value={doulaTraining} onChange={(e) => setDoulaTraining(e.target.value)} className="input-field" placeholder="Ex.: Curso de Doulas GAMA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-since">Atua como doula desde (ano)</Label>
                <Input id="g-since" inputMode="numeric" maxLength={4} value={practiceSince} onChange={(e) => setPracticeSince(e.target.value.replace(/\D/g, "").slice(0, 4))} className="input-field" placeholder="2020" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-bio">Apresentação (opcional)</Label>
                <Textarea id="g-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </div>
              <div className="rounded-2xl bg-muted/50 p-3 flex gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CPF e data de nascimento ficam visíveis somente para você e para a equipe
                  responsável pela plataforma — nunca para clientes, colaboradoras ou outras doulas.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={acceptPrivacy} onCheckedChange={(v) => setAcceptPrivacy(v === true)} />
                <span>
                  Li e aceito a{" "}
                  <Link to="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  e confirmo que meus dados são verdadeiros.
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={saving}>Voltar</Button>
                <Button className="flex-1" onClick={save} disabled={!validStep3 || saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
