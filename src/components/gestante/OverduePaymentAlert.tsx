import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function OverduePaymentAlert() {
  const { client } = useGestanteAuth();
  const navigate = useNavigate();

  const { data: overduePayments } = useQuery({
    queryKey: ["overdue-payments", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, due_date, installment_number, total_installments")
        .eq("client_id", client.id)
        .lt("due_date", today)
        .neq("status", "pago");
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  if (!overduePayments || overduePayments.length === 0) return null;

  const totalOverdue = overduePayments.reduce(
    (sum, p) => sum + (Number(p.amount) - 0),
    0
  );

  return (
    <Card className="border-destructive/50 bg-destructive/5 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-destructive text-sm">
              {overduePayments.length === 1
                ? "Você tem 1 pagamento em atraso"
                : `Você tem ${overduePayments.length} pagamentos em atraso`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total pendente: R${" "}
              {totalOverdue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => navigate("/gestante/mensagens")}
            >
              Ver detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
