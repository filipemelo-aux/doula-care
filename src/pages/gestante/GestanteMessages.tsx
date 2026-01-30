import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  Loader2,
  CheckCircle,
  Clock,
  Sparkles,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import { formatBrazilDateTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Notification = Tables<"client_notifications">;

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  budget_sent_at: string | null;
  created_at: string;
}

export default function GestanteMessages() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { client } = useGestanteAuth();
  const queryClient = useQueryClient();

  // Fetch regular notifications
  useEffect(() => {
    if (client?.id) {
      fetchNotifications();
    }
  }, [client?.id]);

  const fetchNotifications = async () => {
    if (!client?.id) return;

    try {
      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  // Mark notifications as read by client when page loads
  useEffect(() => {
    if (client?.id && notifications.length > 0) {
      const unreadByClient = notifications.filter(n => !(n as any).read_by_client);
      if (unreadByClient.length > 0) {
        markAllAsReadByClient(unreadByClient.map(n => n.id));
      }
    }
  }, [client?.id, notifications]);

  const markAllAsReadByClient = async (ids: string[]) => {
    try {
      await supabase
        .from("client_notifications")
        .update({ read_by_client: true })
        .in("id", ids);
    } catch (error) {
      console.error("Error marking as read by client:", error);
    }
  };

  // Fetch service requests with budget_sent status
  const { data: pendingBudgets } = useQuery({
    queryKey: ["my-pending-budgets", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("client_id", client.id)
        .eq("status", "budget_sent")
        .order("budget_sent_at", { ascending: false });

      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!client?.id,
    refetchInterval: 30000,
  });

  // Accept budget mutation
  const acceptBudgetMutation = useMutation({
    mutationFn: async (request: ServiceRequest) => {
      if (!client?.id) throw new Error("Cliente não encontrado");

      // Update service request status to accepted
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Create a transaction for the approved service
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          client_id: client.id,
          type: "receita",
          description: `Serviço aprovado: ${request.service_type}`,
          amount: request.budget_value || 0,
          date: new Date().toISOString().split("T")[0],
          payment_method: "pix",
          is_auto_generated: true,
        });

      if (transactionError) throw transactionError;

      // Create notification for admin
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: client.id,
          title: `Orçamento Aceito: ${request.service_type}`,
          message: `O orçamento de R$ ${(request.budget_value || 0).toFixed(2).replace(".", ",")} para ${request.service_type} foi aceito.`,
          read: false,
        });

      if (notifError) console.error("Error creating notification:", notifError);
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Orçamento aceito!", {
        description: `O serviço de ${request.service_type} foi adicionado aos seus pagamentos.`,
      });
    },
    onError: () => {
      toast.error("Erro ao aceitar orçamento", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  // Reject budget mutation
  const rejectBudgetMutation = useMutation({
    mutationFn: async (request: ServiceRequest) => {
      if (!client?.id) throw new Error("Cliente não encontrado");

      // Update service request status to rejected
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Create notification for admin
      const { error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: client.id,
          title: `Orçamento Recusado: ${request.service_type}`,
          message: `O orçamento de R$ ${(request.budget_value || 0).toFixed(2).replace(".", ",")} para ${request.service_type} foi recusado.`,
          read: false,
        });

      if (notifError) console.error("Error creating notification:", notifError);
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-budgets"] });
      toast.info("Orçamento recusado", {
        description: `Você recusou o serviço de ${request.service_type}.`,
      });
    },
    onError: () => {
      toast.error("Erro ao recusar orçamento", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  // Count unread for client (using read_by_client field)
  const unreadCount = notifications.filter(n => !(n as any).read_by_client).length + (pendingBudgets?.length || 0);

  // Check if a notification is a budget notification
  const isBudgetNotification = (notification: Notification) => {
    return notification.title.startsWith("Orçamento:");
  };

  // Filter out budget notifications from regular notifications (they're handled separately)
  const regularNotifications = notifications.filter(n => !isBudgetNotification(n));

  return (
    <GestanteLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg">Mensagens</h1>
              <p className="text-xs text-muted-foreground">Comunicados da sua Doula</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} nova{unreadCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : regularNotifications.length === 0 && (!pendingBudgets || pendingBudgets.length === 0) ? (
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-dashed">
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-primary/40 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhuma mensagem</h3>
              <p className="text-muted-foreground text-sm">
                Você receberá aqui os comunicados e orientações da sua Doula
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-3">
              {/* Pending budgets - highlighted */}
              {pendingBudgets?.map((budget) => (
                <Card
                  key={`budget-${budget.id}`}
                  className="bg-purple-50 border-purple-200 shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-purple-600 text-white text-[10px]">
                            Orçamento
                          </Badge>
                          <p className="font-medium text-purple-900">{budget.service_type}</p>
                        </div>
                        <p className="text-2xl font-bold text-purple-700 my-2">
                          R$ {(budget.budget_value || 0).toFixed(2).replace(".", ",")}
                        </p>
                        <p className="text-sm text-purple-600/80 mb-3">
                          Sua Doula enviou este orçamento. Deseja aprovar?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => acceptBudgetMutation.mutate(budget)}
                            disabled={acceptBudgetMutation.isPending || rejectBudgetMutation.isPending}
                          >
                            {acceptBudgetMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Aceitar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => rejectBudgetMutation.mutate(budget)}
                            disabled={acceptBudgetMutation.isPending || rejectBudgetMutation.isPending}
                          >
                            {rejectBudgetMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Recusar
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-purple-500 mt-3">
                          {budget.budget_sent_at && formatBrazilDateTime(budget.budget_sent_at, "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Regular notifications */}
              {regularNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`transition-all ${
                    (notification as any).read_by_client 
                      ? "bg-background" 
                      : "bg-primary/5 border-primary/20 shadow-sm"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {(notification as any).read_by_client ? (
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Clock className="h-4 w-4 text-primary" />
                          )}
                          <p className="font-medium">{notification.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-3">
                          {formatBrazilDateTime(notification.created_at, "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </GestanteLayout>
  );
}
