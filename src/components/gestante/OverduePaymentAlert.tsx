import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function OverduePaymentAlert() {
  const { client } = useGestanteAuth();
  const navigate = useNavigate();
  const [sessionDismissed, setSessionDismissed] = useState(false);

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

  if (sessionDismissed || !overduePayments || overduePayments.length === 0) return null;

  const totalOverdue = overduePayments.reduce(
    (sum, p) => sum + (Number(p.amount) - 0),
    0
  );

  const handleTemporaryDismiss = () => {
    setSessionDismissed(true);
  };

  const handleViewDetails = () => {
    // Navigate with overdue flag so PaymentDetailsDialog auto-selects the first overdue installment
    navigate("/gestante/perfil?tab=plano&overdue=true");
  };

  return (
    <Card className="bg-destructive/5 shadow-md relative">
      <CardContent className="p-4 pr-12">
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
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs text-destructive"
              onClick={handleViewDetails}
            >
              Ver detalhes →
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleTemporaryDismiss}
          title="Fechar temporariamente"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
