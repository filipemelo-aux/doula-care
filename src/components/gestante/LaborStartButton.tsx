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

interface LaborStartButtonProps {
  laborStarted: boolean;
  onLaborStarted: () => void;
}

export function LaborStartButton({ laborStarted, onLaborStarted }: LaborStartButtonProps) {
  const { client } = useGestanteAuth();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleStartLabor = async () => {
    if (!client?.id) return;
    
    setLoading(true);
    try {
      // Update client with labor start time
      const { error: updateError } = await supabase
        .from("clients")
        .update({ labor_started_at: new Date().toISOString() })
        .eq("id", client.id);

      if (updateError) throw updateError;

      // Send notification to Doula
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: client.id,
          title: "🚨 TRABALHO DE PARTO INICIADO",
          message: `${client.full_name} informou que o trabalho de parto começou! Entre em contato imediatamente.`
        });

      if (notifError) {
        console.error("Error sending notification:", notifError);
      }

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
      <div className="bg-gradient-to-br from-pink-100 to-rose-100 border-2 border-pink-300 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center animate-pulse">
          <Heart className="h-8 w-8 text-white" />
        </div>
        <h3 className="font-display font-bold text-lg text-pink-800 mb-1">
          Trabalho de Parto Iniciado
        </h3>
        <p className="text-sm text-pink-700">
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
          className="w-full h-auto py-6 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg rounded-2xl"
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
            <Baby className="h-12 w-12 mx-auto mb-3 text-pink-500" />
            Confirmar início do trabalho de parto?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Sua Doula será notificada imediatamente e entrará em contato com você.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <AlertDialogAction
            onClick={handleStartLabor}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
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
