import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { ServiceRequestButtons } from "@/components/gestante/ServiceRequestButton";
import { ScheduledServicesCard } from "@/components/gestante/ScheduledServicesCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Send, Loader2, Calendar, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  budget_sent_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  scheduled_date: string | null;
  preferred_date: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
  budget_sent: { label: "Orçamento Enviado", icon: Send, className: "bg-purple-100 text-purple-800 border-purple-300" },
  date_proposed: { label: "Confirmar Data", icon: Calendar, className: "bg-orange-100 text-orange-800 border-orange-300" },
  accepted: { label: "Aceito", icon: CheckCircle, className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  completed: { label: "Concluído", icon: CheckCircle, className: "bg-blue-100 text-blue-800 border-blue-300" },
  rejected: { label: "Recusado", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300" },
};

export default function GestanteServices() {
  const { client, organizationId } = useGestanteAuth();
  const clientOrganizationId = client?.organization_id || organizationId || null;
  const queryClient = useQueryClient();

  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ["my-pending-services", client?.id],
    queryFn: async () => {
      let query = supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, budget_sent_at, responded_at, completed_at, scheduled_date, preferred_date, created_at")
        .eq("client_id", client!.id)
        .in("status", ["pending", "budget_sent", "date_proposed", "rejected"]);

      if (clientOrganizationId) {
        query = query.eq("organization_id", clientOrganizationId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!client?.id,
  });

  // Budget response mutation (accept/reject)
  const respondMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: string }) => {
      const { data, error } = await supabase.functions.invoke("respond-budget", {
        body: { request_id: requestId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-services"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-services"] });
      queryClient.invalidateQueries({ queryKey: ["my-service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-budgets"] });
      if (variables.action === "accept") {
        if (data?.status === "date_proposed") {
          toast.success("Orçamento aceito!", {
            description: "Confirme a data proposta pela sua Doula.",
          });
        } else {
          toast.success("Orçamento aceito!", {
            description: "O serviço foi adicionado à sua agenda.",
          });
        }
      } else if (variables.action === "reject") {
        toast.info("Orçamento recusado.");
      } else if (variables.action === "accept_date") {
        toast.success("Data confirmada!", {
          description: "O serviço está em andamento.",
        });
      } else if (variables.action === "reject_date") {
        toast.info("Data recusada. Sua Doula será notificada para propor outra.");
      }
    },
    onError: () => {
      toast.error("Erro ao processar resposta", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  return (
    <GestanteLayout>
      <div className="p-3 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Serviços</h1>
          <p className="page-description">Solicite e acompanhe seus serviços</p>
        </div>

        <div className="space-y-6">
          {/* Scheduled/accepted services with completion & rating */}
          {client?.id && <ScheduledServicesCard clientId={client.id} organizationId={clientOrganizationId} />}

          {/* Pending & other status requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">
                Solicitações
              </h3>
              <div className="space-y-2">
                {pendingRequests.map((svc) => {
                  const status = svc.completed_at ? "completed" : svc.status;
                  const config = statusConfig[status] || statusConfig.pending;
                  const StatusIcon = config.icon;

                  return (
                    <Card key={svc.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{svc.service_type}</p>
                          <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          {svc.budget_value ? (
                            <p className="text-sm text-muted-foreground">
                              R$ {svc.budget_value.toFixed(2).replace(".", ",")}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Aguardando orçamento</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatBrazilDateTime(svc.created_at, "dd/MM/yyyy")}
                          </p>
                        </div>

                        {/* Show preferred date */}
                        {svc.preferred_date && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Sua preferência: {formatBrazilDateTime(svc.preferred_date, "dd/MM/yyyy 'às' HH:mm")}</span>
                          </div>
                        )}

                        {/* Show scheduled/proposed date if different */}
                        {svc.scheduled_date && svc.scheduled_date !== svc.preferred_date && (
                          <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                            <ArrowRight className="h-3.5 w-3.5" />
                            <span>Data proposta: {formatBrazilDateTime(svc.scheduled_date, "dd/MM/yyyy 'às' HH:mm")}</span>
                          </div>
                        )}

                        {/* Action buttons for budget_sent */}
                        {status === "budget_sent" && svc.budget_value && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => respondMutation.mutate({ requestId: svc.id, action: "accept" })}
                              disabled={respondMutation.isPending}
                            >
                              {respondMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                              Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => respondMutation.mutate({ requestId: svc.id, action: "reject" })}
                              disabled={respondMutation.isPending}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        )}

                        {/* Action buttons for date_proposed */}
                        {status === "date_proposed" && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-orange-700 bg-orange-50 rounded-md px-2 py-1.5">
                              Sua Doula propôs uma nova data. Você aceita?
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => respondMutation.mutate({ requestId: svc.id, action: "accept_date" })}
                                disabled={respondMutation.isPending}
                              >
                                {respondMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Aceitar Data
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => respondMutation.mutate({ requestId: svc.id, action: "reject_date" })}
                                disabled={respondMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Recusar Data
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Available services to request */}
          <ServiceRequestButtons />
        </div>
      </div>
    </GestanteLayout>
  );
}
