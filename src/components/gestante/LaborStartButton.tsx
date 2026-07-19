import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Baby, Loader2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotifications";

interface LaborStartButtonProps {
  laborStarted: boolean;
  onLaborStarted: () => void;
}

// Same criterion as birthAlerts.ts / GestanteContractions.tsx (condition 3):
// 3+ contractions within the last 10 minutes with duration >= 60s OR still ongoing.
async function hasActiveLaborPattern(clientId: string): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("contractions")
    .select("started_at, ended_at, duration_seconds")
    .eq("client_id", clientId)
    .gte("started_at", since);
  if (error || !data) return false;
  const qualifying = data.filter(
    (c) => (c.duration_seconds ?? 0) >= 60 || !c.ended_at,
  );
  return qualifying.length >= 3;
}

export function LaborStartButton({ laborStarted, onLaborStarted }: LaborStartButtonProps) {
  const { client, organizationId } = useGestanteAuth();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleStartLabor = async () => {
    if (!client?.id) return;
    
    setLoading(true);
    try {
      // Validate condition 3 before marking labor as started
      const patternOk = await hasActiveLaborPattern(client.id);
      if (!patternOk) {
        toast.error(
          "Ainda não identificamos um padrão de trabalho de parto ativo. Registre suas contrações — o sistema detecta automaticamente quando o padrão aparecer (3 ou mais em 10 minutos, com pelo menos 1 minuto de duração).",
          { duration: 8000 },
        );
        setOpen(false);
        return;
      }

      // Update client with labor start time
      const { error: updateError } = await supabase
        .from("clients")
        .update({ labor_started_at: new Date().toISOString(), labor_started_by: "client" } as any)
        .eq("id", client.id);

      if (updateError) throw updateError;

      // Send notification to Doula
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: client.id,
          title: "🚨 TRABALHO DE PARTO INICIADO",
          message: `${client.full_name} informou que o trabalho de parto começou! Entre em contato imediatamente.`,
          organization_id: organizationId || null,
        });

      if (notifError) {
        console.error("Error sending notification:", notifError);
      }

      // Send push notification to admins
      sendPushNotification({
        send_to_admins: true,
        title: "🚨 TRABALHO DE PARTO INICIADO",
        message: `${client.full_name} informou que o trabalho de parto começou!`,
        type: "labor_started",
        priority: "critica",
        require_interaction: true,
        tag: "labor-started",
      });

      toast.success("Sua Doula foi notificada!");
      onLaborStarted();
      setOpen(false);
    } catch (error) {
      console.error("Error starting labor:", error);
      toast.error("Erro ao registrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (laborStarted) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-accent/10rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
          <Heart className="h-8 w-8 text-white" />
        </div>
        <h3 className="font-display font-bold text-lg text-accent mb-1">
          Trabalho de Parto Iniciado
        </h3>
        <p className="text-sm text-accent/80">
          Sua Doula foi notificada e está acompanhando você ❤️
        </p>
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          size="lg" 
          className="w-full h-auto py-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg rounded-2xl"
        >
          <div className="flex flex-col items-center gap-2">
            <Baby className="h-8 w-8" />
            <span className="font-display font-semibold text-lg">
              O trabalho de parto começou
            </span>
            <span className="text-xs opacity-80">
              Toque para notificar sua Doula
            </span>
          </div>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center">
            <Baby className="h-12 w-12 mx-auto mb-3 text-primary" />
            Confirmar início do trabalho de parto?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Só confirme se você estiver com contrações fortes e frequentes (pelo menos 3 em 10 minutos, cada uma com mais de 1 minuto). Sua Doula será notificada imediatamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <AlertDialogAction
            onClick={handleStartLabor}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Heart className="h-4 w-4 mr-2" />
            )}
            Sim, começou!
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">
            Ainda não
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
