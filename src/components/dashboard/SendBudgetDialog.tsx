import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Send, Sparkles } from "lucide-react";
import { sendPushNotification } from "@/lib/pushNotifications";

interface ServiceRequest {
  id: string;
  client_id: string;
  service_type: string;
  client_name: string;
}

interface SendBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequest: ServiceRequest | null;
}

export function SendBudgetDialog({ open, onOpenChange, serviceRequest }: SendBudgetDialogProps) {
  const [budgetValue, setBudgetValue] = useState("");
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  const sendBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!serviceRequest) throw new Error("Solicitação não encontrada");

      const value = parseFloat(budgetValue.replace(",", "."));
      if (isNaN(value) || value <= 0) {
        throw new Error("Valor inválido");
      }

      // Update service request with budget
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({
          budget_value: value,
          status: "budget_sent",
          budget_sent_at: new Date().toISOString(),
        })
        .eq("id", serviceRequest.id);

      if (updateError) throw updateError;

      // Create notification for client
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: serviceRequest.client_id,
          title: `Orçamento: ${serviceRequest.service_type}`,
          message: `Sua Doula enviou um orçamento de R$ ${value.toFixed(2).replace(".", ",")} para o serviço de ${serviceRequest.service_type}. Acesse suas mensagens para aceitar ou recusar.`,
          read: false,
          organization_id: organizationId || null,
        });

      if (notifError) throw notifError;

      // Push notification to client
      sendPushNotification({
        client_ids: [serviceRequest.client_id],
        title: `Orçamento: ${serviceRequest.service_type}`,
        message: `Sua Doula enviou um orçamento de R$ ${value.toFixed(2).replace(".", ",")}`,
        url: "/gestante/mensagens",
        tag: "budget-sent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
      toast.success("Orçamento enviado com sucesso!", {
        description: "A cliente receberá uma notificação para aprovar.",
      });
      setBudgetValue("");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.message === "Valor inválido") {
        toast.error("Valor inválido", {
          description: "Digite um valor válido para o orçamento.",
        });
      } else {
        toast.error("Erro ao enviar orçamento", {
          description: "Tente novamente em alguns instantes.",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendBudgetMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Enviar Orçamento
          </DialogTitle>
          <DialogDescription>
            {serviceRequest && (
              <>
                Serviço: <strong>{serviceRequest.service_type}</strong>
                <br />
                Cliente: <strong>{serviceRequest.client_name}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget-value">Valor do serviço (R$)</Label>
              <Input
                id="budget-value"
                type="text"
                placeholder="0,00"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                className="text-lg font-semibold"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A cliente receberá este orçamento e poderá aceitar ou recusar. Se aceito, o valor será adicionado aos serviços a pagar.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendBudgetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={sendBudgetMutation.isPending || !budgetValue}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {sendBudgetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Orçamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
