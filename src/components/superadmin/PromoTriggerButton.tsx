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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Gift, Loader2, Crown, Zap } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { sendPushNotification } from "@/lib/pushNotifications";
import { ptBR } from "date-fns/locale";

interface PromoTriggerButtonProps {
  orgId: string;
  orgName: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  trial_active: { label: "Trial ativo", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  lifetime_active: { label: "Vitalício ∞", variant: "default" },
};

export function PromoTriggerButton({ orgId, orgName }: PromoTriggerButtonProps) {
  const queryClient = useQueryClient();
  const [trialDays, setTrialDays] = useState<number>(7);

  const { data: promo } = useQuery({
    queryKey: ["org-promo", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .in("status", ["trial_active", "lifetime_active", "pending"])
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const sendPromoMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const trialEnds = addDays(now, trialDays);

      const { error: promoError } = await supabase
        .from("org_promotions" as any)
        .insert({
          organization_id: orgId,
          promotion_type: "trial",
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          status: "trial_active",
        } as any);
      if (promoError) throw promoError;

      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "premium" as any })
        .eq("id", orgId);
      if (orgError) throw orgError;

      const { error: notifError } = await supabase
        .from("org_notifications")
        .insert({
          organization_id: orgId,
          title: "🎉 Experiência Premium ativada!",
          message: `Parabéns! Você ganhou ${trialDays} dias gratuitos para experimentar todos os recursos do plano Premium completo. Aproveite ao máximo!`,
          type: "promotion",
        });
      if (notifError) throw notifError;

      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId);

      if (orgProfiles && orgProfiles.length > 0) {
        const adminUserIds = orgProfiles.map(p => p.user_id);
        await sendPushNotification({
          user_ids: adminUserIds,
          title: "🎁 Experiência Premium liberada!",
          message: `Você ganhou ${trialDays} dias para experimentar todos os recursos Premium. Confira!`,
          url: "/admin",
          type: "general",
          tag: "promo-trial",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success(`Promoção enviada para ${orgName}!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const forceExpireMutation = useMutation({
    mutationFn: async () => {
      if (!promo) throw new Error("Sem promoção");
      const { error } = await supabase
        .from("org_promotions" as any)
        .update({ trial_ends_at: new Date().toISOString() } as any)
        .eq("id", promo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      toast.success(`Trial expirado manualmente para ${orgName}`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const makeLifetimeMutation = useMutation({
    mutationFn: async () => {
      if (promo) {
        // Update existing promo to lifetime
        const { error } = await supabase
          .from("org_promotions" as any)
          .update({
            status: "lifetime_active",
            promotion_type: "lifetime_premium",
            trial_ends_at: null,
          } as any)
          .eq("id", promo.id);
        if (error) throw error;
      } else {
        // Create new lifetime promo
        const { error } = await supabase
          .from("org_promotions" as any)
          .insert({
            organization_id: orgId,
            promotion_type: "lifetime_premium",
            status: "lifetime_active",
          } as any);
        if (error) throw error;
      }

      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "premium" as any })
        .eq("id", orgId);
      if (orgError) throw orgError;

      await supabase.from("org_notifications").insert({
        organization_id: orgId,
        title: "👑 Acesso Premium Vitalício!",
        message: "Parabéns! Você recebeu acesso Premium vitalício. Todos os recursos estão liberados para sempre!",
        type: "promotion",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast.success(`${orgName} agora tem acesso vitalício!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (promo) {
    const info = statusLabels[promo.status] || statusLabels.pending;
    const isLifetime = promo.promotion_type === "lifetime_premium" && promo.status === "lifetime_active";
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {isLifetime ? (
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Gift className="h-3.5 w-3.5 text-primary" />
        )}
        <Badge variant={info.variant} className="text-[10px] h-5">
          {info.label}
        </Badge>
        {promo.chosen_plan && (
          <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 text-primary">
            Quer: {promo.chosen_plan}
          </Badge>
        )}
        {promo.trial_ends_at && promo.status === "trial_active" && (
          <span className="text-[10px] text-muted-foreground">
            até {format(new Date(promo.trial_ends_at), "dd/MM", { locale: ptBR })}
          </span>
        )}
        <TooltipProvider>
          {promo.status === "trial_active" && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 gap-1 text-[10px] text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => forceExpireMutation.mutate()}
                    disabled={forceExpireMutation.isPending}
                  >
                    {forceExpireMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Expirar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Expirar trial agora</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 gap-1 text-[10px] text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
                    onClick={() => {
                      if (confirm(`Tornar ${orgName} Premium Vitalício?`)) {
                        makeLifetimeMutation.mutate();
                      }
                    }}
                    disabled={makeLifetimeMutation.isPending}
                  >
                    {makeLifetimeMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Crown className="h-3 w-3" />
                    )}
                    Vitalício
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Tornar vitalício</TooltipContent>
              </Tooltip>
            </div>
          )}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 text-primary hover:bg-primary/5"
            disabled={sendPromoMutation.isPending}
          >
            <Gift className="h-3 w-3" />
            Liberar Trial
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Teste Premium</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Libere acesso completo ao plano Premium para <strong>{orgName}</strong> por um período de teste gratuito.</p>
                <p className="text-xs text-muted-foreground">
                  Ao final do período, a doula será direcionada para escolher e assinar um plano.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="trial-days" className="text-sm font-medium text-foreground">
                    Duração do período gratuito
                  </Label>
                  <Input
                    id="trial-days"
                    type="number"
                    min={1}
                    max={365}
                    value={trialDays}
                    onChange={(e) => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    A doula terá <strong>{trialDays} dias</strong> para experimentar todos os recursos do Premium.
                  </p>
                </div>
              </div>
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
              Liberar Trial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
              onClick={() => {
                if (confirm(`Tornar ${orgName} Premium Vitalício?`)) {
                  makeLifetimeMutation.mutate();
                }
              }}
              disabled={makeLifetimeMutation.isPending}
            >
              {makeLifetimeMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Crown className="h-3 w-3" />
              )}
              Vitalício
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Conceder acesso Premium vitalício</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
