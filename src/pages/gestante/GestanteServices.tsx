import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { ServiceRequestButtons } from "@/components/gestante/ServiceRequestButton";
import { ScheduledServicesCard } from "@/components/gestante/ScheduledServicesCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, CheckCircle, XCircle, Send, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilDateTime } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  budget_sent_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
  budget_sent: { label: "Orçamento Enviado", icon: Send, className: "bg-purple-100 text-purple-800 border-purple-300" },
  accepted: { label: "Aceito", icon: CheckCircle, className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  completed: { label: "Concluído", icon: CheckCircle, className: "bg-blue-100 text-blue-800 border-blue-300" },
  rejected: { label: "Recusado", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300" },
};

export default function GestanteServices() {
  const { client } = useGestanteAuth();

  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ["my-pending-services", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_type, status, budget_value, budget_sent_at, responded_at, completed_at, created_at")
        .eq("client_id", client!.id)
        .in("status", ["pending", "budget_sent", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!client?.id,
  });

  return (
    <GestanteLayout>
      <div className="bg-gradient-to-b from-primary/15 to-background px-4 lg:px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/25 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base">Serviços</h1>
            <p className="text-xs text-muted-foreground">Solicite e acompanhe seus serviços</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Available services to request */}
        <ServiceRequestButtons />

        {/* Scheduled/accepted services with completion & rating */}
        {client?.id && <ScheduledServicesCard clientId={client.id} />}

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
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
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
      </div>
    </GestanteLayout>
  );
}
