import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Gift, Loader2, Crown, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PromoTriggerButtonProps {
  orgId: string;
  orgName: string;
}

type PromoType = "beta_tester" | "lifetime_premium";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  trial_active: { label: "Trial 15d", variant: "default" },
  awaiting_choice: { label: "Aguardando escolha", variant: "secondary" },
  bonus_active: { label: "Bônus ativo", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  lifetime_active: { label: "Vitalício ∞", variant: "default" },
};

export function PromoTriggerButton({ orgId, orgName }: PromoTriggerButtonProps) {
  const queryClient = useQueryClient();
  const [selectedPromo, setSelectedPromo] = useState<PromoType>("beta_tester");

  const { data: promo } = useQuery({
    queryKey: ["org-promo", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .in("promotion_type", ["beta_tester", "lifetime_premium"])
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
          promotion_type: selectedPromo,
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

      // Send notification - same message for both (lifetime is a surprise)
      const { error: notifError } = await supabase
        .from("org_notifications")
        .insert({
          organization_id: orgId,
          title: "🎉 Promoção Beta Tester ativada!",
          message: `Parabéns! Você ganhou 15 dias gratuitos do plano Premium completo como agradecimento por ser uma testadora beta. Ao final do período, você receberá uma surpresa exclusiva!`,
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

  const removePromoMutation = useMutation({
    mutationFn: async () => {
      if (!promo) throw new Error("Sem promoção");

      // Remove promo record
      const { error: delError } = await supabase
        .from("org_promotions" as any)
        .delete()
        .eq("id", promo.id);
      if (delError) throw delError;

      // Revert org plan to free
      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "free" as any })
        .eq("id", orgId);
      if (orgError) throw orgError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success(`Promoção removida de ${orgName}`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const forceExpireMutation = useMutation({
    mutationFn: async () => {
      if (!promo) throw new Error("Sem promoção");
      // Set trial_ends_at to now so the doula sees the post-trial experience
      const { error } = await supabase
        .from("org_promotions" as any)
        .update({
          trial_ends_at: new Date().toISOString(),
        } as any)
        .eq("id", promo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      toast.success(`Trial expirado manualmente para ${orgName}`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (promo) {
    const info = statusLabels[promo.status] || statusLabels.pending;
    const isLifetime = promo.promotion_type === "lifetime_premium";
    return (
      <div className="flex items-center gap-1.5">
        {isLifetime ? (
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Gift className="h-3.5 w-3.5 text-primary" />
        )}
        <Badge variant={info.variant} className="text-[10px] h-5">
          {info.label}
        </Badge>
        {promo.bonus_choice && !isLifetime && (
          <Badge variant="outline" className="text-[10px] h-5">
            {promo.bonus_choice === "extra_30_days" ? "+30 dias" : "50% anual"}
          </Badge>
        )}
        {isLifetime && promo.status === "trial_active" && (
          <Badge variant="outline" className="text-[10px] h-5 border-amber-500/30 text-amber-600">
            surpresa ao final
          </Badge>
        )}
        {promo.trial_ends_at && promo.status === "trial_active" && (
          <span className="text-[10px] text-muted-foreground">
            até {format(new Date(promo.trial_ends_at), "dd/MM", { locale: ptBR })}
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Remover promoção de ${orgName}? O plano voltará para Free.`)) {
                    removePromoMutation.mutate();
                  }
                }}
                disabled={removePromoMutation.isPending}
              >
                {removePromoMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Remover promoção</TooltipContent>
          </Tooltip>
          {promo.status === "trial_active" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-amber-500/60 hover:text-amber-600 hover:bg-amber-500/10"
                  onClick={() => forceExpireMutation.mutate()}
                  disabled={forceExpireMutation.isPending}
                >
                  {forceExpireMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Expirar trial agora</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
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
          <AlertDialogTitle>Enviar Promoção</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>Escolha o tipo de promoção para <strong>{orgName}</strong>:</p>

              <RadioGroup
                value={selectedPromo}
                onValueChange={(v) => setSelectedPromo(v as PromoType)}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors">
                  <RadioGroupItem value="beta_tester" id="beta_tester" className="mt-0.5" />
                  <Label htmlFor="beta_tester" className="cursor-pointer flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm text-foreground">Beta Tester</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      15 dias grátis de Premium → depois escolhe: +30 dias ou 50% desconto anual.
                    </p>
                  </Label>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-amber-500/40 transition-colors">
                  <RadioGroupItem value="lifetime_premium" id="lifetime_premium" className="mt-0.5" />
                  <Label htmlFor="lifetime_premium" className="cursor-pointer flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm text-foreground">Acesso Vitalício Premium</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      15 dias de trial → ao final, revela acesso Premium <strong>vitalício</strong>. A doula ficará em suspense!
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              <p className="text-xs text-muted-foreground">
                O plano será imediatamente atualizado para Premium. Ambas as opções começam com 15 dias de trial.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => sendPromoMutation.mutate()}>
            {sendPromoMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : selectedPromo === "lifetime_premium" ? (
              <Crown className="h-4 w-4 mr-1" />
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
