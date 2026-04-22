import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, X, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getDisplayName(c: any): string {
  const full = (c?.full_name || "").trim();
  const pref = (c?.preferred_name || "").trim();
  // Use full_name as primary; fall back to preferred only if full is empty
  if (full.length >= 2) return full;
  if (pref.length >= 2) return pref;
  return full || pref || "Visitante";
}

function buildWhatsAppUrl(phone: string, name: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = encodeURIComponent(
    `Olá ${name.split(" ")[0] || ""}! 💗 Sou sua doula no Doula Care. Recebi sua solicitação de vínculo e gostaria de conversar com você.`
  );
  return `https://wa.me/${intl}?text=${msg}`;
}

export function MatchRequestsCard() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["org-match-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doula_match_requests" as any)
        .select("*, clients!visitor_client_id(full_name, preferred_name, phone, city, state, dpp, pregnancy_weeks, status)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });

  const handleApprove = async (id: string) => {
    const { error } = await supabase.rpc("approve_doula_match_request" as any, { p_request_id: id });
    if (error) return toast.error("Erro ao aprovar", { description: error.message });
    toast.success("Vínculo aprovado! A gestante já tem acesso completo.");
    qc.invalidateQueries({ queryKey: ["org-match-requests"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.rpc("reject_doula_match_request" as any, { p_request_id: id });
    if (error) return toast.error("Erro ao recusar", { description: error.message });
    toast.success("Solicitação recusada");
    qc.invalidateQueries({ queryKey: ["org-match-requests"] });
  };

  if (isLoading) return null;
  if (requests.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" />
          Novas solicitações de vínculo
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map((r) => {
          const name = getDisplayName(r.clients);
          const phone = r.clients?.phone || "";
          return (
            <div key={r.id} className="rounded-lg bg-background p-3 border border-border/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[r.clients?.city, r.clients?.state].filter(Boolean).join(" - ")}
                    {phone ? ` · ${phone}` : ""}
                  </p>
                  <p className="text-xs mt-1">
                    Plano: <strong>{r.plan_name}</strong> ·{" "}
                    {Number(r.plan_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Solicitado {format(new Date(r.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleReject(r.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(r.id)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                  </Button>
                </div>
              </div>
              {phone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full h-8 text-xs gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#128C7E]"
                  onClick={() => window.open(buildWhatsAppUrl(phone, name), "_blank")}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Conversar no WhatsApp
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
