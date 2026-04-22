import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, MapPin, LogOut, Calendar, UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLocalDate } from "@/lib/utils";
import {
  getGuestProfile,
  setGuestProfile,
  type GuestProfile,
} from "@/lib/guestVisitor";

export default function VisitorProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isGuest = !user;
  const [loading, setLoading] = useState(!isGuest);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [preferredName, setPreferredName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [dpp, setDpp] = useState("");

  useEffect(() => {
    if (isGuest) {
      const g = getGuestProfile();
      setFullName(g.full_name || "");
      setPreferredName(g.preferred_name || "");
      setPhone(g.phone || "");
      setCity(g.city || "");
      setState(g.state || "");
      setDpp(g.dpp || "");
      setLoading(false);
      return;
    }
    if (!user) return;
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("user_id", user.id).maybeSingle();
      if (c) {
        setData(c);
        setPreferredName((c as any).preferred_name || "");
        setFullName(c.full_name || "");
        setPhone(c.phone || "");
        setCity(c.city || "");
        setState(c.state || "");
        setDpp(c.dpp || "");
      }
      setLoading(false);
    })();
  }, [user, isGuest]);

  const save = async () => {
    if (isGuest) {
      const profile: GuestProfile = {
        full_name: fullName || null,
        preferred_name: preferredName || null,
        phone: phone || null,
        city: city || null,
        state: state || null,
        dpp: dpp || null,
      };
      setGuestProfile(profile);
      toast.success("Perfil salvo no dispositivo 💗", {
        description: "Crie sua conta para sincronizar.",
        position: "top-center",
        duration: 2500,
      });
      setTimeout(() => navigate("/visitante"), 800);
      return;
    }

    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ preferred_name: preferredName, phone, city, state })
      .eq("id", data.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Perfil atualizado! 💗", {
      description: "Suas informações foram salvas.",
      position: "top-center",
      duration: 2500,
    });
    setTimeout(() => navigate("/visitante"), 1000);
  };

  if (loading) {
    return (
      <VisitorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout>
      <div className="space-y-4">
        <div className="page-header">
          <h1 className="page-title">Meu perfil</h1>
          <p className="page-description">
            {isGuest ? "Salvo apenas no seu dispositivo" : "Suas informações pessoais"}
          </p>
        </div>

        {isGuest && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Crie sua conta gratuita para sincronizar seus dados em todos os dispositivos e se
                conectar com uma doula.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Dados pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isGuest}
                mask="name"
                className="input-field"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Como prefere ser chamada</Label>
              <Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} mask="name" className="input-field" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} mask="phone" placeholder="(11) 91234-5678" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="input-field" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UF</Label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} className="input-field" />
              </div>
            </div>
            {isGuest && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> DPP (data provável do parto)</Label>
                <Input type="date" value={dpp} onChange={(e) => setDpp(e.target.value)} className="input-field" />
              </div>
            )}
          </CardContent>
        </Card>

        {!isGuest && data?.dpp && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">DPP</p>
                <p className="font-medium text-sm">
                  {format(getLocalDate(data.dpp), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Button className="w-full h-11" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
        </Button>

        {isGuest ? (
          <Button
            variant="outline"
            className="w-full h-11 text-primary hover:text-primary border-primary/30"
            onClick={() => navigate("/cadastro-visitante")}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Criar minha conta
          </Button>
        ) : (
          <Button variant="outline" className="w-full h-11 text-destructive hover:text-destructive" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair da conta
          </Button>
        )}
      </div>
    </VisitorLayout>
  );
}
