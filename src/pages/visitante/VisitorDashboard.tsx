import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Heart, Loader2, LogOut, Sparkles, Clock, CheckCircle, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

// Fix default marker icons (Leaflet+Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface PublicDoula {
  id: string;
  name: string;
  nome_exibicao: string | null;
  logo_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  service_areas: string[] | null;
  latitude: number | null;
  longitude: number | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface DoulaPlan {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  features: string[] | null;
  plan_type: string;
}

function FlyToVisitor({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 11);
  }, [lat, lng, map]);
  return null;
}

export default function VisitorDashboard() {
  const { user, signOut, client } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoula, setSelectedDoula] = useState<PublicDoula | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Visitor's stored coords
  const visitorLat = (client as any)?.visitor_latitude ?? null;
  const visitorLng = (client as any)?.visitor_longitude ?? null;

  const { data: doulas = [], isLoading: loadingDoulas } = useQuery({
    queryKey: ["public-doulas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_doulas" as any);
      if (error) throw error;
      return (data || []) as PublicDoula[];
    },
  });

  const { data: activeRequest } = useQuery({
    queryKey: ["my-match-request", user?.id],
    enabled: !!user?.id,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("doula_match_requests" as any)
        .select("*, organizations(name, nome_exibicao, logo_url)")
        .eq("visitor_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (activeRequest?.status === "approved") {
      toast.success("Sua doula aprovou seu vínculo!", { description: "Entrando na sua área..." });
      setTimeout(() => window.location.reload(), 1500);
    }
  }, [activeRequest?.status]);

  const filteredDoulas = useMemo(() => {
    if (!search.trim()) return doulas;
    const s = search.toLowerCase();
    return doulas.filter(d =>
      (d.nome_exibicao || d.name).toLowerCase().includes(s) ||
      (d.city || "").toLowerCase().includes(s) ||
      (d.state || "").toLowerCase().includes(s)
    );
  }, [doulas, search]);

  const sortedDoulas = useMemo(() => {
    const cityNorm = (client as any)?.city?.toLowerCase() || "";
    const stateNorm = (client as any)?.state?.toUpperCase() || "";
    return [...filteredDoulas].sort((a, b) => {
      const aSameCity = (a.city || "").toLowerCase() === cityNorm ? 0 : 1;
      const bSameCity = (b.city || "").toLowerCase() === cityNorm ? 0 : 1;
      if (aSameCity !== bSameCity) return aSameCity - bSameCity;
      const aSameState = (a.state || "").toUpperCase() === stateNorm ? 0 : 1;
      const bSameState = (b.state || "").toUpperCase() === stateNorm ? 0 : 1;
      return aSameState - bSameState;
    });
  }, [filteredDoulas, client]);

  const doulasOnMap = sortedDoulas.filter(d => d.latitude && d.longitude);
  const defaultCenter: [number, number] = visitorLat && visitorLng
    ? [Number(visitorLat), Number(visitorLng)]
    : [-14.235, -51.9253];

  const sameCityCount = useMemo(() => {
    const cityNorm = (client as any)?.city?.toLowerCase() || "";
    if (!cityNorm) return 0;
    return doulas.filter(d => (d.city || "").toLowerCase() === cityNorm).length;
  }, [doulas, client]);

  return (
    <div className="h-[100dvh] flex flex-col safe-area-top safe-area-bottom bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Header padronizado h-14 */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-card/95 backdrop-blur-sm z-40 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden shrink-0">
            <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">Doula Care</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              Olá, {(client as any)?.preferred_name || (client as any)?.full_name?.split(" ")[0] || "visitante"} 💗
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl mx-auto px-4 py-4 space-y-4">
          {activeRequest?.status === "pending" && (
            <Card className="border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Aguardando resposta da doula</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Você solicitou o plano <strong>{activeRequest.plan_name}</strong> com{" "}
                    <strong>{activeRequest.organizations?.nome_exibicao || activeRequest.organizations?.name}</strong>.
                    Assim que ela responder, você será notificada.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {activeRequest?.status === "rejected" && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Solicitação anterior recusada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sem problemas — escolha outra doula abaixo para enviar uma nova solicitação.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hero CTA — busca amigável */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Heart className="h-5 w-5 text-primary" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base sm:text-lg font-semibold">Está precisando de uma doula?</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Encontre profissionais perto de você, conheça os planos e solicite o vínculo.
                    {sameCityCount > 0 && <> Já temos <strong className="text-foreground">{sameCityCount}</strong> doula{sameCityCount > 1 ? "s" : ""} na sua cidade.</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="lg"
                  className="flex-1 h-11"
                  onClick={() => { setViewMode("list"); setSearchOpen(true); }}
                  disabled={activeRequest?.status === "pending"}
                >
                  <Search className="h-4 w-4 mr-2" /> Encontrar uma doula
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11"
                  onClick={() => { setViewMode("map"); setSearchOpen(true); }}
                  disabled={activeRequest?.status === "pending"}
                >
                  <MapPin className="h-4 w-4 mr-2" /> Ver no mapa
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Como funciona */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Como funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4 px-4">
              <ol className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="font-semibold text-primary">1.</span> Escolha uma doula próxima a você.</li>
                <li className="flex gap-2"><span className="font-semibold text-primary">2.</span> Veja os planos oferecidos por ela.</li>
                <li className="flex gap-2"><span className="font-semibold text-primary">3.</span> Solicite o vínculo — ela responde em breve.</li>
                <li className="flex gap-2"><span className="font-semibold text-primary">4.</span> Aprovado? Você passa a ter acompanhamento completo. 💗</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de busca: lista + mapa em abas */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 max-h-[90dvh] flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Encontrar uma doula
            </DialogTitle>
            <DialogDescription className="text-xs">
              {sortedDoulas.length} profissiona{sortedDoulas.length === 1 ? "l" : "is"} disponíve{sortedDoulas.length === 1 ? "l" : "is"}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-3 space-y-3 border-b border-border/40 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou cidade"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 input-field h-10"
              />
            </div>
            <div className="flex gap-1 p-1 bg-muted/60 rounded-lg w-fit">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                Lista
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                  viewMode === "map" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                <MapPin className="h-3 w-3" /> Mapa
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-[300px]">
            {viewMode === "list" ? (
              <div className="h-full overflow-y-auto p-3 space-y-2">
                {loadingDoulas ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : sortedDoulas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhuma doula encontrada.</p>
                ) : (
                  sortedDoulas.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDoula(d); setSearchOpen(false); }}
                      disabled={activeRequest?.status === "pending"}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed border border-border/40"
                    >
                      <div className="h-11 w-11 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                        {d.logo_url ? (
                          <img src={d.logo_url} alt={d.name} className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.nome_exibicao || d.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          <MapPin className="inline h-3 w-3 mr-0.5" />
                          {[d.city, d.state].filter(Boolean).join(" - ") || "Localização não informada"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="h-full w-full">
                <MapContainer center={defaultCenter} zoom={visitorLat ? 11 : 4} className="h-full w-full" style={{ background: "hsl(var(--muted))" }}>
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FlyToVisitor lat={visitorLat ? Number(visitorLat) : null} lng={visitorLng ? Number(visitorLng) : null} />
                  {visitorLat && visitorLng && (
                    <Marker position={[Number(visitorLat), Number(visitorLng)]}>
                      <Popup>Você está aqui</Popup>
                    </Marker>
                  )}
                  {doulasOnMap.map(d => (
                    <Marker
                      key={d.id}
                      position={[Number(d.latitude), Number(d.longitude)]}
                      eventHandlers={{ click: () => { setSelectedDoula(d); setSearchOpen(false); } }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{d.nome_exibicao || d.name}</strong>
                          <p className="text-xs text-muted-foreground">{[d.city, d.state].filter(Boolean).join(" - ")}</p>
                          <button className="text-primary text-xs underline mt-1" onClick={() => { setSelectedDoula(d); setSearchOpen(false); }}>
                            Ver planos
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DoulaPlansDialog
        doula={selectedDoula}
        onClose={() => setSelectedDoula(null)}
        canRequest={activeRequest?.status !== "pending"}
        onRequested={() => {
          setSelectedDoula(null);
          queryClient.invalidateQueries({ queryKey: ["my-match-request"] });
        }}
      />
    </div>
  );
}

function DoulaPlansDialog({
  doula, onClose, canRequest, onRequested
}: {
  doula: PublicDoula | null;
  onClose: () => void;
  canRequest: boolean;
  onRequested: () => void;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const open = !!doula;

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["doula-plans", doula?.id],
    enabled: !!doula?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_doula_plans" as any, { p_organization_id: doula!.id });
      if (error) throw error;
      return (data || []) as DoulaPlan[];
    },
  });

  const handleChoose = async (plan: DoulaPlan) => {
    if (!doula) return;
    setSubmitting(plan.id);
    const { data: reqId, error } = await supabase.rpc("create_doula_match_request" as any, {
      p_organization_id: doula.id,
      p_plan_setting_id: plan.id,
      p_message: null,
    });
    if (!error && reqId) {
      // fire-and-forget push to the doula
      supabase.functions.invoke("notify-match-request", { body: { request_id: reqId } }).catch(() => {});
    }
    setSubmitting(null);
    if (error) {
      toast.error("Não foi possível enviar a solicitação", { description: error.message });
      return;
    }
    toast.success("Solicitação enviada!", { description: "A doula receberá um aviso e responderá em breve." });
    onRequested();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {doula?.logo_url ? <img src={doula.logo_url} alt="" className="w-full h-full object-cover" /> : <Heart className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <p className="text-base">{doula?.nome_exibicao || doula?.name}</p>
              <p className="text-[11px] text-muted-foreground font-normal">
                <MapPin className="inline h-3 w-3" /> {[doula?.city, doula?.state].filter(Boolean).join(" - ") || "—"}
              </p>
            </div>
          </DialogTitle>
          {doula?.bio && (
            <DialogDescription className="text-xs leading-relaxed pt-1">{doula.bio}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Esta doula ainda não cadastrou planos públicos.</p>
          ) : (
            plans.map(p => (
              <Card key={p.id} className="border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {Number(p.default_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Badge>
                  </div>
                  {p.features && p.features.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground space-y-0.5">
                      {p.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!canRequest || submitting === p.id}
                    onClick={() => handleChoose(p)}
                  >
                    {submitting === p.id ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Enviando...</> : "Solicitar este plano"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        {!canRequest && (
          <p className="text-[11px] text-amber-600 text-center">Você já tem uma solicitação pendente — aguarde a resposta antes de escolher outra doula.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
