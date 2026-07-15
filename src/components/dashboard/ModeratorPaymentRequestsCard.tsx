import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, X, ArrowRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type RequestRow = {
  id: string;
  client_id: string;
  amount: number;
  notes: string | null;
  created_at: string;
  moderator_id: string;
  clients?: { full_name: string; preferred_name: string | null } | null;
  profiles?: { full_name: string | null } | null;
};

export function ModeratorPaymentRequestsCard() {
  const { user, organizationId, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = role === "admin";

  const { data: requests } = useQuery({
    queryKey: ["moderator-payment-requests", organizationId],
    enabled: !!organizationId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderator_payment_requests" as any)
        .select("id, client_id, amount, notes, created_at, moderator_id, clients(full_name, preferred_name)")
        .eq("organization_id", organizationId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RequestRow[];
    },
    refetchInterval: 30000,
  });

  const moderatorIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.moderator_id))),
    [requests]
  );

  const { data: moderators } = useQuery({
    queryKey: ["moderator-payment-requests-profiles", moderatorIds],
    enabled: moderatorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", moderatorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = p.full_name || "Moderadora";
      });
      return map;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("moderator_payment_requests" as any)
        .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderator-payment-requests"] });
      toast.success("Solicitação cancelada");
    },
    onError: () => toast.error("Erro ao cancelar solicitação"),
  });

  const handleRegister = (req: RequestRow) => {
    navigate("/financeiro", {
      state: {
        openPaymentClientId: req.client_id,
        requestedAmount: Number(req.amount),
        moderatorRequestId: req.id,
      },
    });
  };

  if (!isAdmin || !requests || requests.length === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">Registros de pagamento pendentes</p>
          <p className="text-[11px] text-muted-foreground">
            Solicitações feitas pela sua equipe aguardando aprovação
          </p>
        </div>
        <Badge className="ml-auto bg-primary text-primary-foreground">{requests.length}</Badge>
      </div>

      <div className="space-y-2">
        {requests.map((req) => {
          const clientName = req.clients?.preferred_name?.trim() || req.clients?.full_name || "Cliente";
          const modName = moderators?.[req.moderator_id] || "Moderadora";
          const amount = Number(req.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          return (
            <div key={req.id} className="rounded-xl bg-background border border-border/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {modName} • {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  {req.notes && (
                    <p className="text-xs text-foreground/70 mt-1 line-clamp-2">"{req.notes}"</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{amount}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => cancelMutation.mutate(req.id)}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleRegister(req)}
                >
                  Registrar
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
