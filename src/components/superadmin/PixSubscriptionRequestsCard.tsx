import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QrCode, Check, X } from "lucide-react";

interface PixRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_id: string;
  billing_type: "monthly" | "yearly";
  amount: number;
  status: string;
  declared_at: string;
  plan?: { plan: string; name: string };
}

function formatCentavos(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PixSubscriptionRequestsCard() {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sa-pix-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_pix_payments" as any)
        .select("*, plan:platform_plan_limits!inner(plan, name)")
        .eq("status", "awaiting_confirmation")
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as PixRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-pix-profiles", rows.map((r) => r.user_id).join(",")],
    queryFn: async () => {
      if (!rows.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", rows.map((r) => r.user_id));
      return (data || []) as { user_id: string; full_name: string | null }[];
    },
    enabled: rows.length > 0,
  });

  const approve = useMutation({
    mutationFn: async (row: PixRow) => {
      const now = new Date();
      const end = new Date(now);
      if (row.billing_type === "yearly") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);

      await supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: now.toISOString() })
        .eq("user_id", row.user_id)
        .eq("status", "active");

      const { error: insErr } = await supabase.from("subscriptions").insert({
        user_id: row.user_id,
        plan_id: row.plan_id,
        status: "active",
        platform: "pix",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
      });
      if (insErr) throw insErr;

      if (row.organization_id && row.plan?.plan) {
        await supabase
          .from("organizations")
          .update({ plan: row.plan.plan as any, updated_at: now.toISOString() })
          .eq("id", row.organization_id);
      }

      const { error } = await supabase
        .from("plan_pix_payments" as any)
        .update({
          status: "approved",
          reviewed_at: now.toISOString(),
        } as any)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-pix-payments"] });
      queryClient.invalidateQueries({ queryKey: ["sa-subscriptions"] });
      toast.success("Pagamento aprovado e plano liberado!");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: async (row: PixRow) => {
      const { error } = await supabase
        .from("plan_pix_payments" as any)
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-pix-payments"] });
      toast.success("Pagamento recusado");
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <QrCode className="h-4 w-4 text-primary" />
        Pagamentos Pix de Assinatura
        {rows.length > 0 && (
          <Badge className="bg-primary/10 text-primary text-[10px] h-5">{rows.length}</Badge>
        )}
      </h2>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Nenhum pagamento Pix aguardando confirmação.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const name =
              profiles.find((p) => p.user_id === row.user_id)?.full_name || "Usuária";
            return (
              <Card key={row.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.plan?.name} ·{" "}
                      {row.billing_type === "yearly" ? "Anual" : "Mensal"} ·{" "}
                      {formatCentavos(row.amount)} ·{" "}
                      {format(new Date(row.declared_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject.mutate(row)}
                      disabled={reject.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(row)}
                      disabled={approve.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
