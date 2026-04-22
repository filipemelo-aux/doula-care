import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, QrCode, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PixRequest {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_id: string;
  billing_type: string;
  amount: number;
  status: string;
  declared_at: string;
}

export function PixPaymentRequestsCard() {
  const qc = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["pix-payment-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_pix_payments" as any)
        .select("*")
        .eq("status", "awaiting_confirmation")
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PixRequest[];
    },
    refetchInterval: 15000,
  });

  // Carrega nomes das orgs e planos
  const orgIds = Array.from(new Set((requests ?? []).map(r => r.organization_id).filter(Boolean))) as string[];
  const planIds = Array.from(new Set((requests ?? []).map(r => r.plan_id)));

  const { data: orgs } = useQuery({
    queryKey: ["pix-orgs", orgIds],
    queryFn: async () => {
      if (orgIds.length === 0) return {};
      const { data } = await supabase.from("organizations").select("id, name, nome_exibicao").in("id", orgIds);
      const m: Record<string, string> = {};
      (data ?? []).forEach((o: any) => { m[o.id] = (o.nome_exibicao && o.nome_exibicao.trim()) || o.name; });
      return m;
    },
    enabled: orgIds.length > 0,
  });

  const { data: plans } = useQuery({
    queryKey: ["pix-plans", planIds],
    queryFn: async () => {
      if (planIds.length === 0) return {};
      const { data } = await supabase.from("platform_plan_limits").select("id, name").in("id", planIds);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.id] = p.name; });
      return m;
    },
    enabled: planIds.length > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("approve-pix-payment", {
        body: { id, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? "Pagamento aprovado!" : "Pagamento rejeitado");
      qc.invalidateQueries({ queryKey: ["pix-payment-requests"] });
      setActingId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao processar");
      setActingId(null);
    },
  });

  const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Pagamentos Pix Pendentes
              {requests && requests.length > 0 && (
                <Badge variant="destructive" className="ml-1">{requests.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Doulas que declararam pagamento via Pix aguardando sua confirmação
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum pagamento Pix pendente de confirmação.
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl bg-muted/30 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {orgs?.[r.organization_id || ""] || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(r.declared_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{fmt(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {plans?.[r.plan_id] || "—"} / {r.billing_type === "yearly" ? "Anual" : "Mensal"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setActingId(r.id + "-rej"); reviewMutation.mutate({ id: r.id, action: "reject" }); }}
                    disabled={reviewMutation.isPending && actingId?.startsWith(r.id)}
                  >
                    {actingId === r.id + "-rej" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                    Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => { setActingId(r.id + "-app"); reviewMutation.mutate({ id: r.id, action: "approve" }); }}
                    disabled={reviewMutation.isPending && actingId?.startsWith(r.id)}
                  >
                    {actingId === r.id + "-app" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    Confirmar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
