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
import { Gift, Loader2, Crown, Zap, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { addDays, format, differenceInDays } from "date-fns";
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
  expired: { label: "Expirado", variant: "destructive" },
  lifetime_active: { label: "Vitalício ∞", variant: "default" },
};

export function PromoTriggerButton({ orgId, orgName }: PromoTriggerButtonProps) {
  const queryClient = useQueryClient();
  const [trialDays, setTrialDays] = useState<number>(7);

  const { data: subscription } = useQuery({
    queryKey: ["org-subscription-sa", orgId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle();

      if (!profile?.user_id) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, plan_id")
        .eq("user_id", profile.user_id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  const { data: promo } = useQuery({
    queryKey: ["org-promo", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .in("status", ["trial_active", "lifetime_active", "pending"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["org-promo", orgId] });
    queryClient.invalidateQueries({ queryKey: ["org-subscription-sa", orgId] });
    queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
  };

  const sendTrialMutation = useMutation({
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

      await supabase.from("org_notifications").insert({
        organization_id: orgId,
        title: "🎉 Teste Premium ativado!",
        message: `Você recebeu ${trialDays} dias de teste para usar todos os recursos do plano Premium.`,
        type: "promotion",
      });

      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId);

      if (orgProfiles && orgProfiles.length > 0) {
        await sendPushNotification({
          user_ids: orgProfiles.map((p) => p.user_id),
          title: "🎁 Teste Premium liberado!",
          message: `Seu teste de ${trialDays} dias do Premium já está ativo.`,
          url: "/admin",
          type: "general",
          tag: "promo-trial",
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(`Trial liberado para ${orgName}!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const forceExpireMutation = useMutation({
    mutationFn: async () => {
      if (!promo) throw new Error("Sem trial ativo");

      await supabase
        .from("org_promotions" as any)
        .update({ status: "expired", trial_ends_at: new Date().toISOString() } as any)
        .eq("id", promo.id);

      await supabase
        .from("organizations")
        .update({ plan: "free" as any })
        .eq("id", orgId);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(`Trial encerrado para ${orgName}`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const makeLifetimeMutation = useMutation({
    mutationFn: async () => {
      if (promo) {
        await supabase
          .from("org_promotions" as any)
          .update({
            status: "lifetime_active",
            promotion_type: "lifetime_premium",
            trial_ends_at: null,
            chosen_plan: null,
            bonus_choice: null,
            bonus_chosen_at: null,
            bonus_started_at: null,
            bonus_ends_at: null,
          } as any)
          .eq("id", promo.id);
      } else {
        await supabase
          .from("org_promotions" as any)
          .insert({
            organization_id: orgId,
            promotion_type: "lifetime_premium",
            status: "lifetime_active",
            trial_ends_at: null,
          } as any);
      }

      await supabase
        .from("organizations")
        .update({ plan: "premium" as any })
        .eq("id", orgId);

      await supabase.from("org_notifications").insert({
        organization_id: orgId,
        title: "👑 Acesso Premium Vitalício!",
        message: "Acesso Premium vitalício concedido para esta organização.",
        type: "promotion",
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(`${orgName} agora tem acesso vitalício!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const hasActiveSub = subscription?.status === "active";
  const isLifetime = promo?.status === "lifetime_active";
  const renewalDate = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
    : null;
  const daysLeft = subscription?.current_period_end
    ? Math.max(0, differenceInDays(new Date(subscription.current_period_end), new Date()))
    : null;

  const lifetimeButton = !isLifetime ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-1 text-[10px] text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"
          onClick={() => {
            if (confirm(`Tornar ${orgName} vitalício?`)) {
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
          Tornar vitalício
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Conceder acesso Premium vitalício</TooltipContent>
    </Tooltip>
  ) : null;

  if (hasActiveSub) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <CreditCard className="h-3.5 w-3.5 text-green-600" />
        <Badge variant="default" className="text-[10px] h-5 bg-green-600/10 text-green-700">
          Assinante
        </Badge>
        {renewalDate && (
          <span className="text-[10px] text-muted-foreground">
            renova {renewalDate} ({daysLeft}d)
          </span>
        )}
        <TooltipProvider>{lifetimeButton}</TooltipProvider>
      </div>
    );
  }

  if (promo) {
    const info = statusLabels[promo.status] || statusLabels.pending;

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
        {promo.trial_ends_at && promo.status === "trial_active" && (
          <span className="text-[10px] text-muted-foreground">
            até {format(new Date(promo.trial_ends_at), "dd/MM", { locale: ptBR })}
          </span>
        )}
        <TooltipProvider>
          {promo.status === "trial_active" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 gap-1 text-[10px] text-destructive bg-destructive/5 hover:bg-destructive/10"
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
              <TooltipContent side="top" className="text-xs">Encerrar trial agora</TooltipContent>
            </Tooltip>
          )}
          {lifetimeButton}
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
            disabled={sendTrialMutation.isPending}
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
                <p>
                  Libere acesso completo ao plano Premium para <strong>{orgName}</strong> por um período de teste gratuito.
                </p>
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
            <AlertDialogAction onClick={() => sendTrialMutation.mutate()}>
              {sendTrialMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Gift className="h-4 w-4 mr-1" />
              )}
              Liberar Trial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TooltipProvider>{lifetimeButton}</TooltipProvider>
    </div>
  );
}
