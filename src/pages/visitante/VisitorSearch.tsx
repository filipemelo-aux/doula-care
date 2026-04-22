import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  Heart,
  Loader2,
  Sparkles,
  CheckCircle,
  Search,
  Clock,
  MessageCircle,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalize } from "@/lib/ibgeCities";
import { GuestSignupPrompt } from "@/components/visitante/GuestSignupPrompt";

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
  whatsapp: string | null;
  instagram: string | null;
}

function buildWhatsAppUrl(phone: string, doulaName: string) {
  const digits = (phone || "").replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = encodeURIComponent(
    `Olá ${doulaName}! Encontrei seu perfil no Doula Care e gostaria de saber mais sobre seu trabalho. 💗`
  );
  return `https://wa.me/${withCountry}?text=${msg}`;
}

function buildInstagramUrl(handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  return `https://instagram.com/${clean}`;
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

export default function VisitorSearch() {
  const { user, client } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoula, setSelectedDoula] = useState<PublicDoula | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

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
    queryFn: async () => {
      const { data } = await supabase
        .from("doula_match_requests" as any)
        .select("*")
        .eq("visitor_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const filteredDoulas = useMemo(() => {
    if (!search.trim()) return doulas;
    const s = normalize(search);
    return doulas.filter(
      (d) =>
        normalize(d.nome_exibicao || d.name).includes(s) ||
        normalize(d.city || "").includes(s) ||
        normalize(d.state || "").includes(s) ||
        normalize(d.neighborhood || "").includes(s) ||
        (d.service_areas || []).some((a) => normalize(a).includes(s))
    );
  }, [doulas, search]);

  const sortedDoulas = useMemo(() => {
    const cityNorm = normalize((client as any)?.city || "");
    const stateNorm = ((client as any)?.state || "").toUpperCase();
    return [...filteredDoulas].sort((a, b) => {
      const aSameCity = normalize(a.city || "") === cityNorm ? 0 : 1;
      const bSameCity = normalize(b.city || "") === cityNorm ? 0 : 1;
      if (aSameCity !== bSameCity) return aSameCity - bSameCity;
      const aSameState = (a.state || "").toUpperCase() === stateNorm ? 0 : 1;
      const bSameState = (b.state || "").toUpperCase() === stateNorm ? 0 : 1;
      return aSameState - bSameState;
    });
  }, [filteredDoulas, client]);

  const doulasOnMap = sortedDoulas.filter((d) => d.latitude && d.longitude);
  const defaultCenter: [number, number] =
    visitorLat && visitorLng ? [Number(visitorLat), Number(visitorLng)] : [-14.235, -51.9253];

  return (
    <VisitorLayout>
      <div className="space-y-4">
        <div className="page-header mb-2">
          <h1 className="page-title">Encontrar uma doula</h1>
          <p className="page-description">
            {sortedDoulas.length} profissiona{sortedDoulas.length === 1 ? "l" : "is"} disponíve
            {sortedDoulas.length === 1 ? "l" : "is"}
          </p>
        </div>

        {activeRequest?.status === "pending" && (
          <Card className="border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="p-3 flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Você já enviou uma solicitação. Aguarde a resposta antes de escolher outra doula.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou cidade"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {viewMode === "list" ? (
          <div className="space-y-2">
            {loadingDoulas ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : sortedDoulas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Nenhuma doula encontrada.
              </p>
            ) : (
              sortedDoulas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDoula(d)}
                  disabled={activeRequest?.status === "pending"}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card shadow-card hover:shadow-[var(--shadow-card-hover)] transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="rounded-2xl overflow-hidden h-[400px] shadow-card">
            <MapContainer
              center={defaultCenter}
              zoom={visitorLat ? 11 : 4}
              className="h-full w-full"
              style={{ background: "hsl(var(--muted))" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToVisitor
                lat={visitorLat ? Number(visitorLat) : null}
                lng={visitorLng ? Number(visitorLng) : null}
              />
              {visitorLat && visitorLng && (
                <Marker position={[Number(visitorLat), Number(visitorLng)]}>
                  <Popup>Você está aqui</Popup>
                </Marker>
              )}
              {doulasOnMap.map((d) => (
                <Marker
                  key={d.id}
                  position={[Number(d.latitude), Number(d.longitude)]}
                >
                  <Popup>
                    <div className="text-sm space-y-1.5 min-w-[160px]">
                      <strong className="block">{d.nome_exibicao || d.name}</strong>
                      <p className="text-xs text-muted-foreground !m-0">
                        <MapPin className="inline h-3 w-3 mr-0.5" />
                        {[d.city, d.state].filter(Boolean).join(" - ") || "—"}
                      </p>
                      <button
                        className="w-full mt-1 px-2 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                        onClick={() => {
                          setViewMode("list");
                          setSelectedDoula(d);
                        }}
                      >
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

      <DoulaPlansDialog
        doula={selectedDoula}
        onClose={() => setSelectedDoula(null)}
        canRequest={activeRequest?.status !== "pending"}
        onRequested={() => {
          setSelectedDoula(null);
          queryClient.invalidateQueries({ queryKey: ["my-match-request"] });
        }}
      />
    </VisitorLayout>
  );
}

function DoulaPlansDialog({
  doula,
  onClose,
  canRequest,
  onRequested,
}: {
  doula: PublicDoula | null;
  onClose: () => void;
  canRequest: boolean;
  onRequested: () => void;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<DoulaPlan | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const open = !!doula;

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["doula-plans", doula?.id],
    enabled: !!doula?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_doula_plans" as any, {
        p_organization_id: doula!.id,
      });
      if (error) throw error;
      return (data || []) as DoulaPlan[];
    },
  });

  const handleConfirmChoose = async () => {
    if (!doula || !confirmPlan) return;
    const plan = confirmPlan;
    setSubmitting(plan.id);
    const { data: reqId, error } = await supabase.rpc("create_doula_match_request" as any, {
      p_organization_id: doula.id,
      p_plan_setting_id: plan.id,
      p_message: null,
    });
    if (!error && reqId) {
      supabase.functions.invoke("notify-match-request", { body: { request_id: reqId } }).catch(() => {});
    }
    setSubmitting(null);
    setConfirmPlan(null);
    if (error) {
      toast.error("Não foi possível enviar a solicitação", { description: error.message });
      return;
    }
    setSuccessOpen(true);
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    onRequested();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {doula?.logo_url ? (
                <img src={doula.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Heart className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <p className="text-base">{doula?.nome_exibicao || doula?.name}</p>
              <p className="text-[11px] text-muted-foreground font-normal">
                <MapPin className="inline h-3 w-3" />{" "}
                {[doula?.city, doula?.state].filter(Boolean).join(" - ") || "—"}
              </p>
            </div>
          </DialogTitle>
          {doula?.bio && (
            <DialogDescription className="text-xs leading-relaxed pt-1 text-justify hyphens-auto">{doula.bio}</DialogDescription>
          )}
        </DialogHeader>

        {(doula?.whatsapp || doula?.instagram) && (
          <div className="flex flex-wrap gap-2 -mt-1">
            {doula?.whatsapp && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-w-[140px] gap-1.5 bg-[hsl(142_71%_45%/0.08)] hover:bg-[hsl(142_71%_45%/0.16)] border-[hsl(142_71%_45%/0.3)] text-[hsl(142_71%_30%)]"
                onClick={() =>
                  window.open(buildWhatsAppUrl(doula.whatsapp!, doula.nome_exibicao || doula.name), "_blank")
                }
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            )}
            {doula?.instagram && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-w-[140px] gap-1.5 bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30 text-pink-600 dark:text-pink-400"
                onClick={() => window.open(buildInstagramUrl(doula.instagram!), "_blank")}
              >
                <Instagram className="h-3.5 w-3.5" />
                @{doula.instagram.replace(/^@/, "")}
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Esta doula ainda não cadastrou planos públicos.
            </p>
          ) : (
            plans.map((p) => (
              <Card key={p.id} className="border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {p.features && p.features.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground space-y-0.5">
                      {p.features.slice(0, 6).map((f, i) => (
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
                    onClick={() => setConfirmPlan(p)}
                  >
                    {submitting === p.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Enviando...
                      </>
                    ) : (
                      "Quero este plano"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {plans.length > 0 && !isLoading && (
          <div className="mt-2 rounded-xl bg-primary/5 border border-primary/15 p-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-[11.5px] text-foreground/80 leading-relaxed">
              Após escolher um plano, a <strong>doula entrará em contato com você pelo WhatsApp</strong> para
              alinhar valores, datas e tirar todas as suas dúvidas. 💗
            </p>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!confirmPlan} onOpenChange={(o) => !o && !submitting && setConfirmPlan(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar escolha do plano</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Você está escolhendo o plano <strong>{confirmPlan?.name}</strong> com{" "}
              <strong>{doula?.nome_exibicao || doula?.name}</strong>. Ao confirmar, ela receberá sua
              solicitação e entrará em contato em breve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChoose} disabled={!!submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={successOpen} onOpenChange={(o) => !o && handleSuccessClose()}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-br from-primary/95 via-primary to-primary/90 text-primary-foreground shadow-2xl">
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary-foreground/15 flex items-center justify-center animate-in zoom-in-50 duration-500">
              <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-primary-foreground animate-in zoom-in-75 duration-700" strokeWidth={2.5} />
              </div>
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-xl font-bold text-primary-foreground">
                Solicitação enviada! 💗
              </DialogTitle>
              <DialogDescription className="text-sm text-primary-foreground/90 leading-relaxed">
                <strong className="text-primary-foreground">{doula?.nome_exibicao || doula?.name}</strong>{" "}
                recebeu sua solicitação e entrará em contato com você em breve.
              </DialogDescription>
            </div>
            <Button
              variant="secondary"
              className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-medium"
              onClick={handleSuccessClose}
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
