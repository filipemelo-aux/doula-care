import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, ChevronRight, Wrench } from "lucide-react";

interface CustomService {
  id: string;
  name: string;
  icon: string;
}

export function ServiceRequestButtons() {
  const [selectedService, setSelectedService] = useState<CustomService | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { client, organizationId } = useGestanteAuth();
  const queryClient = useQueryClient();

  const isGestante = client?.status === "gestante";
  const clientOrganizationId = client?.organization_id || organizationId || null;

  const { data: services = [] } = useQuery({
    queryKey: ["client-available-services", client?.id, clientOrganizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_services")
        .select("id, name, icon")
        .eq("organization_id", clientOrganizationId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as CustomService[];
    },
    enabled: !!client?.id && !!clientOrganizationId,
  });

  // Filter: gestantes can't see Laserterapia
  const availableServices = services.filter((s) => {
    if (isGestante && s.name.toLowerCase() === "laserterapia") return false;
    return true;
  });

  const requestMutation = useMutation({
    mutationFn: async (service: CustomService) => {
      if (!client?.id) throw new Error("Cliente não encontrado");
      const { error } = await supabase.from("service_requests").insert({
        client_id: client.id,
        service_type: service.name,
        status: "pending",
        organization_id: clientOrganizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-service-requests"] });
      toast.success("Solicitação enviada com sucesso!", {
        description: "Sua Doula receberá uma notificação e enviará o orçamento.",
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

  const handleServiceClick = (service: CustomService) => {
    setSelectedService(service);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRequest = () => {
    if (selectedService) {
      requestMutation.mutate(selectedService);
    }
  };

  if (availableServices.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
          Solicitar Serviços
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {availableServices.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              onClick={() => handleServiceClick(service)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-lg">
                  {service.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{service.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && (
                <>
                  <span className="text-lg">{selectedService.icon}</span>
                  Solicitar {selectedService.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Ao confirmar, sua Doula receberá sua solicitação e enviará um orçamento para sua aprovação.
            </DialogDescription>
          </DialogHeader>
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
