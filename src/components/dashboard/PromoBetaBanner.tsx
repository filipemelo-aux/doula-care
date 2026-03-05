import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, CalendarPlus, Percent, Loader2, CheckCircle, Clock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PromoBetaBanner() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);

  const { data: promo } = useQuery({
    queryKey: ["my-org-promo", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .eq("promotion_type", "beta_tester")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const chooseBonusMutation = useMutation({
    mutationFn: async (choice: "extra_30_days" | "annual_50_discount") => {
      if (!promo || !organizationId) throw new Error("Promoção não encontrada");

      const now = new Date();
      const updates: any = {
        bonus_choice: choice,
        bonus_chosen_at: now.toISOString(),
        status: "bonus_active",
        bonus_started_at: now.toISOString(),
      };

      if (choice === "extra_30_days") {
        updates.bonus_ends_at = addDays(now, 30).toISOString();

        // Notify about the extension
        await supabase.from("org_notifications").insert({
          organization_id: organizationId,
          title: "🎉 Bônus ativado: +30 dias Premium!",
          message: `Seu bônus de 30 dias extras no plano Premium foi ativado! Válido até ${format(addDays(now, 30), "dd/MM/yyyy", { locale: ptBR })}.`,
          type: "promotion",
        });
      } else {
        // For the annual discount, we notify about the billing
        await supabase.from("org_notifications").insert({
          organization_id: organizationId,
          title: "🎉 Bônus ativado: 50% desconto anual!",
          message: `Você escolheu 50% de desconto no plano Premium anual. A cobrança será gerada automaticamente com o desconto aplicado.`,
          type: "promotion",
        });
      }

      const { error } = await supabase
        .from("org_promotions" as any)
        .update(updates)
        .eq("id", promo.id);
      if (error) throw error;
    },
    onSuccess: (_, choice) => {
      queryClient.invalidateQueries({ queryKey: ["my-org-promo", organizationId] });
      setChoiceDialogOpen(false);
      toast.success(
        choice === "extra_30_days"
          ? "30 dias extras de Premium ativados!"
          : "Desconto de 50% no plano anual ativado!"
      );
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (!promo) return null;

  // Don't show for completed promos
  if (promo.status === "completed") return null;

  const trialEndsAt = promo.trial_ends_at ? new Date(promo.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, now)) : 0;
  const isTrialExpired = trialEndsAt && now >= trialEndsAt;
  const showChoiceButton = promo.status === "trial_active" || promo.status === "awaiting_choice";

  // Trial active banner
  if (promo.status === "trial_active" && !isTrialExpired) {
    return (
      <>
        <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <Gift className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Teste Premium Gratuito
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Você está aproveitando o plano Premium gratuitamente!{" "}
            <strong className="text-foreground">{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</strong>.
            {daysLeft <= 3 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-xs text-primary"
                onClick={() => setChoiceDialogOpen(true)}
              >
                Escolher seu bônus agora →
              </Button>
            )}
          </AlertDescription>
        </Alert>
        <BonusChoiceDialog
          open={choiceDialogOpen}
          onOpenChange={setChoiceDialogOpen}
          onChoose={(c) => chooseBonusMutation.mutate(c)}
          isPending={chooseBonusMutation.isPending}
        />
      </>
    );
  }

  // Trial expired or awaiting choice
  if (showChoiceButton && isTrialExpired) {
    return (
      <>
        <Alert className="border-amber-500/50 bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
            Seu teste Premium expirou!
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
            Escolha seu bônus exclusivo de testadora beta para continuar aproveitando.
            <Button
              variant="default"
              size="sm"
              className="ml-2 h-7 text-xs"
              onClick={() => setChoiceDialogOpen(true)}
            >
              <Gift className="h-3 w-3 mr-1" />
              Escolher Bônus
            </Button>
          </AlertDescription>
        </Alert>
        <BonusChoiceDialog
          open={choiceDialogOpen}
          onOpenChange={setChoiceDialogOpen}
          onChoose={(c) => chooseBonusMutation.mutate(c)}
          isPending={chooseBonusMutation.isPending}
        />
      </>
    );
  }

  // Bonus active banner
  if (promo.status === "bonus_active") {
    const bonusEndsAt = promo.bonus_ends_at ? new Date(promo.bonus_ends_at) : null;
    const bonusDaysLeft = bonusEndsAt ? Math.max(0, differenceInDays(bonusEndsAt, now)) : null;

    if (promo.bonus_choice === "extra_30_days") {
      return (
        <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary text-sm font-semibold">
            Bônus Premium +30 dias ativo
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Aproveite seu plano Premium gratuito!{" "}
            {bonusDaysLeft !== null && (
              <strong className="text-foreground">
                {bonusDaysLeft} dia{bonusDaysLeft !== 1 ? "s" : ""} restante{bonusDaysLeft !== 1 ? "s" : ""}.
              </strong>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <Percent className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary text-sm font-semibold">
          Desconto de 50% ativado!
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Você escolheu 50% de desconto no plano Premium anual. A cobrança com desconto será gerada em breve.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function BonusChoiceDialog({
  open,
  onOpenChange,
  onChoose,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: "extra_30_days" | "annual_50_discount") => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Escolha seu Bônus Exclusivo
          </DialogTitle>
          <DialogDescription>
            Como agradecimento por ser uma testadora beta, você pode escolher um dos bônus abaixo:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
            onClick={() => !isPending && onChoose("extra_30_days")}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <CalendarPlus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">+30 dias de Premium grátis</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Continue usando o plano Premium completo por mais 30 dias sem custo. Totalizando 45 dias gratuitos!
                </p>
              </div>
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
            onClick={() => !isPending && onChoose("annual_50_discount")}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/30 transition-colors">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">50% de desconto no Premium anual</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assine o plano Premium anual com 50% de desconto. A cobrança será gerada automaticamente.
                </p>
              </div>
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
