import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ChevronRight, Sparkles, Zap, Sun, LucideIcon } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
}

const services: ServiceType[] = [
  {
    id: "taping",
    name: "Taping",
    description: "Bandagem elástica terapêutica para alívio de dores e suporte muscular",
    icon: Sparkles,
    gradient: "from-purple-100 to-purple-200",
    iconColor: "text-purple-600",
  },
  {
    id: "ventosaterapia",
    name: "Ventosaterapia",
    description: "Técnica de sucção para alívio de tensões musculares e melhora da circulação",
    icon: Sun,
    gradient: "from-orange-100 to-amber-200",
    iconColor: "text-orange-600",
  },
  {
    id: "laserterapia",
    name: "Laserterapia",
    description: "Tratamento com laser de baixa intensidade para cicatrização e analgesia",
    icon: Zap,
    gradient: "from-cyan-100 to-blue-200",
    iconColor: "text-cyan-600",
  },
];

export function ServiceRequestButtons() {
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { client } = useGestanteAuth();
  const queryClient = useQueryClient();

  const requestMutation = useMutation({
    mutationFn: async (service: ServiceType) => {
      if (!client?.id) throw new Error("Cliente não encontrado");

      // Create a notification for the doula
      const { error } = await supabase.from("client_notifications").insert({
        client_id: client.id,
        title: `Solicitação de ${service.name}`,
        message: `${client.full_name} solicitou o serviço de ${service.name}. ${service.description}`,
        read: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
      toast.success("Solicitação enviada com sucesso!", {
        description: "Sua Doula receberá uma notificação sobre seu pedido.",
      });
      setConfirmDialogOpen(false);
      setSelectedService(null);
    },
    onError: () => {
      toast.error("Erro ao enviar solicitação", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  const handleServiceClick = (service: ServiceType) => {
    setSelectedService(service);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRequest = () => {
    if (selectedService) {
      requestMutation.mutate(selectedService);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
          Solicitar Serviços
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {services.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              onClick={() => handleServiceClick(service)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                  <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{service.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && (
                <>
                  <selectedService.icon className={`h-5 w-5 ${selectedService.iconColor}`} />
                  Solicitar {selectedService.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedService?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Ao confirmar, sua Doula será notificada sobre sua solicitação e entrará em contato para agendar o atendimento.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={requestMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmRequest}
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Confirmar Solicitação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
