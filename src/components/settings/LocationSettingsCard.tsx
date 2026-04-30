import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, Plus, X, MessageCircle, Instagram, Search } from "lucide-react";
import { toast } from "sonner";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { fetchAddressByCep } from "@/lib/address";
import { maskCEP, unmask } from "@/lib/masks";

export function LocationSettingsCard() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-location", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("city,state,neighborhood,bio,service_areas,latitude,longitude,accepts_new_clients,whatsapp,instagram,postal_code,street,street_number")
        .eq("id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [bio, setBio] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [acceptsNew, setAcceptsNew] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [acceptsNew, setAcceptsNew] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!org) return;
    setCity(org.city || "");
    setState(org.state || "");
    setNeighborhood(org.neighborhood || "");
    setBio(org.bio || "");
    setAreas(org.service_areas || []);
    setLatitude(org.latitude ?? null);
    setLongitude(org.longitude ?? null);
    setAcceptsNew(org.accepts_new_clients ?? true);
    setWhatsapp(org.whatsapp || "");
    setInstagram(org.instagram || "");
  }, [org]);

  const geocodeByCity = async () => {
    if (!city || !state) {
      toast.error("Preencha cidade e estado primeiro");
      return;
    }
    setGeocoding(true);
    try {
      const q = encodeURIComponent(`${city}, ${state}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setLatitude(parseFloat(data[0].lat));
        setLongitude(parseFloat(data[0].lon));
        toast.success("Localização aproximada (centro da cidade) definida");
      } else {
        toast.error("Não foi possível localizar este endereço");
      }
    } catch {
      toast.error("Erro ao buscar localização");
    } finally {
      setGeocoding(false);
    }
  };

  const useDeviceLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Seu dispositivo não suporta geolocalização");
      return;
    }
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        toast.success("Localização exata capturada do seu dispositivo!");
        setGeocoding(false);
      },
      (err) => {
        setGeocoding(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Permissão de localização negada. Habilite nas configurações do navegador/app.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error("Localização indisponível. Tente novamente em área aberta.");
        } else {
          toast.error("Não foi possível obter sua localização");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };


  const addArea = () => {
    const v = newArea.trim();
    if (!v || areas.includes(v)) return;
    setAreas([...areas, v]);
    setNewArea("");
  };

  const removeArea = (a: string) => setAreas(areas.filter(x => x !== a));

  const save = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("organizations")
        .update({
          city: city || null,
          state: state || null,
          neighborhood: neighborhood || null,
          bio: bio || null,
          service_areas: areas,
          latitude,
          longitude,
          accepts_new_clients: acceptsNew,
          whatsapp: whatsapp || null,
          instagram: instagram ? instagram.replace(/^@/, "") : null,
        } as any)
        .eq("id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-location"] });
      toast.success("Localização salva com sucesso! 💗", {
        description: "Suas informações já estão visíveis para gestantes próximas.",
        position: "top-center",
        duration: 3500,
        className: "text-base font-medium",
      });
      setTimeout(() => navigate("/admin"), 1200);
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message, position: "top-center" }),
  });

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Localização e Atendimento</CardTitle>
            <CardDescription>Onde gestantes encontrarão você no mapa público</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div>
            <p className="text-sm font-medium">Aceitando novas clientes</p>
            <p className="text-xs text-muted-foreground">Quando desativado, você não aparece para visitantes</p>
          </div>
          <Switch checked={acceptsNew} onCheckedChange={setAcceptsNew} />
        </div>

        <div className="space-y-2">
          <Label>Mini bio (visível no mapa público)</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ex: Doula certificada com 8 anos de experiência em parto humanizado..."
            rows={3}
            maxLength={300}
          />
          <p className="text-[11px] text-muted-foreground">{bio.length}/300</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cidade</Label>
            <CityAutocomplete
              value={city}
              state={state}
              onChange={(c, s) => { setCity(c); if (s) setState(s); }}
              placeholder="Digite para buscar (ex: São Paulo)"
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Bairro (opcional)</Label>
          <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex: Pinheiros" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> WhatsApp
            </Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              mask="phone"
              placeholder="(11) 91234-5678"
            />
            <p className="text-[11px] text-muted-foreground">Visível no perfil público para gestantes</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5 text-pink-500" /> Instagram
            </Label>
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))}
              placeholder="seu_usuario"
            />
            <p className="text-[11px] text-muted-foreground">Sem o @ — só o nome de usuário</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Regiões atendidas</Label>
          <div className="flex gap-2">
            <Input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Ex: Zona Oeste, ABC..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
            />
            <Button type="button" variant="outline" onClick={addArea}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {areas.map(a => (
              <Badge key={a} variant="secondary" className="gap-1">
                {a}
                <button onClick={() => removeArea(a)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2 p-3 rounded-lg bg-muted/30">
          <Label className="text-xs">Coordenadas no mapa</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="default" onClick={useDeviceLocation} disabled={geocoding} className="gap-1.5">
              {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
              Usar minha localização atual
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={geocodeByCity} disabled={geocoding} className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Usar centro da cidade
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {latitude && longitude
              ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : "Nenhuma coordenada definida — recomendamos usar sua localização atual para que clientes te encontrem com precisão no mapa."}
          </p>
        </div>


        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
