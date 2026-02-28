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
import { Loader2, Send, Sparkles, Calendar, Check, ArrowRight } from "lucide-react";
import { sendPushNotification } from "@/lib/pushNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

interface ServiceRequest {
  id: string;
  client_id: string;
  service_type: string;
  client_name: string;
  preferred_date?: string | null;
}

interface SendBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequest: ServiceRequest | null;
}

export function SendBudgetDialog({ open, onOpenChange, serviceRequest }: SendBudgetDialogProps) {
  const [budgetValue, setBudgetValue] = useState("");
  const [dateAction, setDateAction] = useState<"accept" | "propose">("accept");
  const [proposedDate, setProposedDate] = useState("");
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  const preferredDateFormatted = serviceRequest?.preferred_date
    ? format(
        toZonedTime(new Date(serviceRequest.preferred_date), "America/Sao_Paulo"),
        "dd/MM/yyyy 'às' HH:mm",
        { locale: ptBR }
      )
    : null;

  const sendBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!serviceRequest) throw new Error("Solicitação não encontrada");

      const value = parseFloat(budgetValue.replace(",", "."));
      if (isNaN(value) || value <= 0) {
        throw new Error("Valor inválido");
      }

      const updateData: Record<string, unknown> = {
        budget_value: value,
        status: "budget_sent",
        budget_sent_at: new Date().toISOString(),
      };

      // If doula accepts client's date, set scheduled_date = preferred_date
      if (dateAction === "accept" && serviceRequest.preferred_date) {
        updateData.scheduled_date = serviceRequest.preferred_date;
      } else if (dateAction === "propose" && proposedDate) {
        updateData.scheduled_date = new Date(proposedDate).toISOString();
      }

      const { error: updateError } = await supabase
        .from("service_requests")
        .update(updateData)
        .eq("id", serviceRequest.id);

      if (updateError) throw updateError;

      // Build notification message
      let dateMsg = "";
      if (dateAction === "accept" && serviceRequest.preferred_date) {
        dateMsg = ` Data confirmada: ${preferredDateFormatted}.`;
      } else if (dateAction === "propose" && proposedDate) {
        const propFormatted = format(new Date(proposedDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        dateMsg = ` Nova data proposta: ${propFormatted}. Confirme se aceita.`;
      }

      // Create notification for client
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: serviceRequest.client_id,
          title: `Orçamento: ${serviceRequest.service_type}`,
          message: `Sua Doula enviou um orçamento de R$ ${value.toFixed(2).replace(".", ",")} para o serviço de ${serviceRequest.service_type}.${dateMsg}`,
          read: false,
          organization_id: organizationId || null,
        });

      if (notifError) throw notifError;

      // Push notification to client
      sendPushNotification({
        client_ids: [serviceRequest.client_id],
        title: `Orçamento: ${serviceRequest.service_type}`,
        message: `Sua Doula enviou um orçamento de R$ ${value.toFixed(2).replace(".", ",")}`,
        url: "/gestante/servicos",
        tag: "budget-sent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-services"] });
      toast.success("Orçamento enviado com sucesso!", {
        description: "A cliente receberá uma notificação para aprovar.",
      });
      setBudgetValue("");
      setDateAction("accept");
      setProposedDate("");
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

            {/* Date negotiation */}
            {serviceRequest?.preferred_date && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Data solicitada pela cliente:</p>
                  <p className="font-medium flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    {preferredDateFormatted}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={dateAction === "accept" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setDateAction("accept")}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Aceitar data
                  </Button>
                  <Button
                    type="button"
                    variant={dateAction === "propose" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setDateAction("propose")}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    Propor outra
                  </Button>
                </div>

                {dateAction === "propose" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Nova data proposta</Label>
                    <input
                      type="datetime-local"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                )}
              </div>
            )}

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
              disabled={sendBudgetMutation.isPending || !budgetValue || (dateAction === "propose" && !proposedDate)}
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
