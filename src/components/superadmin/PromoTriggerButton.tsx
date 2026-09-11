import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Crown, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PromoTriggerButtonProps {
  orgId: string;
  orgName: string;
  /** When 'badge' (default): renders only the status badge. When 'actions': renders only the lifetime action button. */
  mode?: "badge" | "actions";
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  trial_active: { label: "Trial ativo", className: "bg-primary/15 text-primary" },
  completed: { label: "Concluído", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirado", className: "bg-destructive/15 text-destructive" },
  lifetime_active: { label: "Vitalício ∞", className: "bg-amber-500/15 text-amber-600" },
};

export function PromoTriggerButton({ orgId, orgName, mode = "badge" }: PromoTriggerButtonProps) {
  const queryClient = useQueryClient();

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

  const lifetimeIconButton = !isLifetime ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"
          onClick={() => {
            if (confirm(`Tornar ${orgName} vitalício?`)) {
              makeLifetimeMutation.mutate();
            }
          }}
          disabled={makeLifetimeMutation.isPending}
        >
          {makeLifetimeMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crown className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Tornar vitalício</TooltipContent>
    </Tooltip>
  ) : null;

  // ===== MODE: actions =====
  if (mode === "actions") {
    return <TooltipProvider>{lifetimeIconButton}</TooltipProvider>;
  }

  // ===== MODE: badge (default) =====
  if (hasActiveSub) {
    return (
      <Badge className="h-5 px-2 text-[10px] font-medium rounded-full inline-flex items-center gap-1 bg-green-600/15 text-green-700">
        <CreditCard className="h-3 w-3" />
        Assinante
        {renewalDate && (
          <span className="opacity-80 font-normal">· renova {renewalDate}</span>
        )}
      </Badge>
    );
  }

  if (promo) {
    const info = statusLabels[promo.status] || statusLabels.pending;
    const trialEndsAt = promo.trial_ends_at
      ? format(new Date(promo.trial_ends_at), "dd/MM/yyyy", { locale: ptBR })
      : null;
    return (
      <Badge className={cn("h-5 px-2 text-[10px] font-medium rounded-full inline-flex items-center gap-1", info.className)}>
        {isLifetime ? <Crown className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
        {info.label}
        {!isLifetime && trialEndsAt && (
          <span className="opacity-80 font-normal">· até {trialEndsAt}</span>
        )}
      </Badge>
    );
  }

  return null;
}
