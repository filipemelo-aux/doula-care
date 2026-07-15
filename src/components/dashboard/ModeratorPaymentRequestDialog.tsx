import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { maskCurrency, parseCurrency } from "@/lib/masks";
import { Loader2, Info } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName?: string;
}

export function ModeratorPaymentRequestDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: Props) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNotes("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user || !organizationId || !clientId) throw new Error("Dados incompletos");
      const value = parseCurrency(amount);
      if (!value || value <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase
        .from("moderator_payment_requests" as any)
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          moderator_id: user.id,
          amount: value,
          notes: notes.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderator-payment-requests"] });
      toast.success("Solicitação enviada", {
        description: "Sua solicitação de registro de pagamento será analisada por uma administradora.",
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar solicitação");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar pagamento</DialogTitle>
          <DialogDescription className="text-xs">
            {clientName ? `Cliente: ${clientName}` : "Envie o valor recebido para análise."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3 text-xs text-foreground/80">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              Sua solicitação será enviada para uma administradora que fará o registro
              oficial do pagamento no financeiro.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Valor recebido</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(maskCurrency(e.target.value))}
              placeholder="R$ 0,00"
              className="h-9 text-sm"
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: pago via Pix na consulta de hoje"
              className="text-sm min-h-[70px]"
              maxLength={500}
            />
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || parseCurrency(amount) <= 0}
            className="w-full"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Enviando...
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
