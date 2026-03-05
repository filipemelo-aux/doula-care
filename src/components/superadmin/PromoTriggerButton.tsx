import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Gift, Loader2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PromoTriggerButtonProps {
  orgId: string;
  orgName: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  trial_active: { label: "Trial 15d", variant: "default" },
  awaiting_choice: { label: "Aguardando escolha", variant: "secondary" },
  bonus_active: { label: "Bônus ativo", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
};

export function PromoTriggerButton({ orgId, orgName }: PromoTriggerButtonProps) {
  const queryClient = useQueryClient();

  const { data: promo } = useQuery({
    queryKey: ["org-promo", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("promotion_type", "beta_tester")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const sendPromoMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const trialEnds = addDays(now, 15);

      // Insert promo record
      const { error: promoError } = await supabase
        .from("org_promotions" as any)
        .insert({
          organization_id: orgId,
          promotion_type: "beta_tester",
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          status: "trial_active",
        } as any);
      if (promoError) throw promoError;

      // Upgrade org to premium
      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "premium" as any })
        .eq("id", orgId);
      if (orgError) throw orgError;

      // Send notification to doula
      const { error: notifError } = await supabase
        .from("org_notifications")
        .insert({
          organization_id: orgId,
          title: "🎉 Promoção Beta Tester ativada!",
          message: `Parabéns! Você ganhou 15 dias gratuitos do plano Premium completo como agradecimento por ser uma testadora beta. Ao final do período, você poderá escolher um bônus exclusivo!`,
          type: "promotion",
        });
      if (notifError) throw notifError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success(`Promoção enviada para ${orgName}!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (promo) {
    const info = statusLabels[promo.status] || statusLabels.pending;
    return (
      <div className="flex items-center gap-1.5">
        <Gift className="h-3.5 w-3.5 text-primary" />
        <Badge variant={info.variant} className="text-[10px] h-5">
          {info.label}
        </Badge>
        {promo.bonus_choice && (
          <Badge variant="outline" className="text-[10px] h-5">
            {promo.bonus_choice === "extra_30_days" ? "+30 dias" : "50% anual"}
          </Badge>
        )}
        {promo.trial_ends_at && promo.status === "trial_active" && (
          <span className="text-[10px] text-muted-foreground">
            até {format(new Date(promo.trial_ends_at), "dd/MM", { locale: ptBR })}
          </span>
        )}
      </div>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/5"
          disabled={sendPromoMutation.isPending}
        >
          <Gift className="h-3 w-3" />
          Enviar Promoção
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar Promoção Beta Tester</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Ao confirmar, <strong>{orgName}</strong> receberá:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>15 dias gratuitos do plano <strong>Premium</strong></li>
              <li>Após 15 dias, poderá escolher entre:
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li><strong>+30 dias grátis</strong> de Premium</li>
                  <li><strong>50% de desconto</strong> no plano Premium anual</li>
                </ul>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              O plano será imediatamente atualizado para Premium.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => sendPromoMutation.mutate()}>
            {sendPromoMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Gift className="h-4 w-4 mr-1" />
            )}
            Confirmar e Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
