import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, X, MessageCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClientDialog } from "@/components/clients/ClientDialog";
import type { Tables } from "@/integrations/supabase/types";

function getDisplayName(c: any): string {
  const full = (c?.full_name || "").trim();
  const pref = (c?.preferred_name || "").trim();
  if (full.length >= 2) return full;
  if (pref.length >= 2) return pref;
  return full || pref || "Visitante";
}

function getFirstAndLast(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function buildWhatsAppUrl(phone: string, name: string, planName: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  const greeting = getFirstAndLast(name);
  const msg = encodeURIComponent(
    `Olá ${greeting}! 💗 Sou sua Doula no Doula Care e vi que você se interessou pelo plano *${planName.trim()}*. ` +
    `Que alegria poder te acompanhar nesse momento tão especial! Podemos conversar para eu te passar mais informações e tirar suas dúvidas?`
  );
  return `https://wa.me/${intl}?text=${msg}`;
}

export function MatchRequestsCard() {
  const qc = useQueryClient();
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<Tables<"clients"> | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["org-match-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_match_requests" as any);
      if (error) throw error;
      // Normalizar para o shape esperado (compat com `r.clients`)
      return ((data || []) as any[]).map((r: any) => ({
        ...r,
        clients: {
          full_name: r.client_full_name,
          preferred_name: r.client_preferred_name,
          phone: r.client_phone,
          city: r.client_city,
          state: r.client_state,
          dpp: r.client_dpp,
          pregnancy_weeks: r.client_pregnancy_weeks,
          status: r.client_status,
        },
      }));
    },
    refetchInterval: 15000,
  });

  const handleApprove = async (req: any) => {
    if (!contactedIds.has(req.id)) {
      toast.warning("Confirme primeiro o contato no WhatsApp", {
        description: "Toque no botão do WhatsApp para abrir a conversa antes de fechar o vínculo.",
      });
      return;
    }
    setApprovingId(req.id);
    const { error } = await supabase.rpc("approve_doula_match_request" as any, { p_request_id: req.id });
    if (error) {
      setApprovingId(null);
      return toast.error("Erro ao fechar vínculo", { description: error.message });
    }
    // Buscar a cliente recém-vinculada
    const { data: clientData, error: fetchErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", req.visitor_client_id)
      .maybeSingle();
    setApprovingId(null);
    qc.invalidateQueries({ queryKey: ["org-match-requests"] });
    qc.invalidateQueries({ queryKey: ["clients"] });

    if (fetchErr || !clientData) {
      toast.success("Negócio fechado! 💗", { description: "Edite a cliente para finalizar o plano e pagamento." });
      return;
    }
    toast.success("Negócio fechado! 💗", { description: "Agora confirme o plano e a forma de pagamento." });
    setEditClient(clientData as any);
    setEditOpen(true);
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.rpc("reject_doula_match_request" as any, { p_request_id: id });
    if (error) return toast.error("Erro ao recusar", { description: error.message });
    toast.success("Solicitação recusada");
    qc.invalidateQueries({ queryKey: ["org-match-requests"] });
  };

  const handleWhatsAppClick = (id: string, url: string) => {
    setContactedIds((prev) => new Set(prev).add(id));
    window.open(url, "_blank");
  };

  if (isLoading) return null;
  if (requests.length === 0 && !editOpen) return null;

  return (
    <>
      {requests.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Gestantes interessadas
              <Badge variant="secondary">{requests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r) => {
              const name = getDisplayName(r.clients);
              const phone = r.clients?.phone || "";
              const hasContacted = contactedIds.has(r.id);
              const planName = r.plan_name || "selecionado";
              const isApproving = approvingId === r.id;
              return (
                <div key={r.id} className="rounded-lg bg-background p-3 border border-border/50">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[r.clients?.city, r.clients?.state].filter(Boolean).join(" - ")}
                      {phone ? ` · ${phone}` : ""}
                    </p>
                    <p className="text-xs">
                      Plano escolhido: <strong>{planName}</strong>
                      {r.plan_value ? (
                        <> · {Number(r.plan_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Solicitado {format(new Date(r.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  {phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full h-9 text-xs gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#128C7E] font-medium"
                      onClick={() => handleWhatsAppClick(r.id, buildWhatsAppUrl(phone, name, planName))}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {hasContacted ? "Conversar novamente no WhatsApp" : "Abrir conversa no WhatsApp"}
                    </Button>
                  )}

                  {hasContacted ? (
                    <p className="mt-2 text-[11px] text-foreground/80 leading-relaxed bg-primary/5 rounded-md px-2 py-1.5">
                      Fechou negócio com <strong>{name}</strong>? Toque em <strong>"Sim, fechei"</strong> para
                      transformá-la em cliente e definir plano e pagamento.
                    </p>
                  ) : (
                    <p className="mt-2 text-[10.5px] text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Converse pelo WhatsApp antes de confirmar o vínculo.
                    </p>
                  )}

                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReject(r.id)} disabled={isApproving}>
                      <X className="h-3.5 w-3.5 mr-1" /> Não fechei
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApprove(r)}
                      disabled={!hasContacted || isApproving}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> {isApproving ? "Vinculando..." : "Sim, fechei"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ClientDialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditClient(null);
        }}
        client={editClient}
        initialStep={6}
      />
    </>
  );
}
