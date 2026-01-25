import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Baby, CheckCircle, AlertTriangle, Calendar } from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface Notification {
  id: string;
  type: "birth_approaching" | "post_term" | "payment_pending";
  title: string;
  description: string;
  client?: Client & { current_weeks?: number | null; current_days?: number; is_post_term?: boolean };
  priority: "high" | "medium" | "low";
  icon: typeof Baby;
  color: string;
}

export function NotificationsCenter() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);

  const { data: birthAlertClients, isLoading: loadingBirth } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .order("pregnancy_weeks", { ascending: false });

      if (error) throw error;
      
      return data
        .map(client => ({
          ...client,
          current_weeks: calculateCurrentPregnancyWeeks(
            client.pregnancy_weeks,
            client.pregnancy_weeks_set_at,
            client.dpp
          ),
          current_days: calculateCurrentPregnancyDays(client.dpp),
          is_post_term: isPostTerm(client.dpp)
        }))
        .filter(client => client.current_weeks !== null && client.current_weeks >= 37)
        .sort((a, b) => {
          if (a.is_post_term && !b.is_post_term) return -1;
          if (!a.is_post_term && b.is_post_term) return 1;
          return (b.current_weeks || 0) - (a.current_weeks || 0);
        });
    },
  });

  const handleRegisterBirth = (client: Client) => {
    setSelectedClient(client);
    setBirthDialogOpen(true);
  };

  // Build notifications list
  const notifications: Notification[] = [];

  // Add birth approaching notifications
  birthAlertClients?.forEach(client => {
    if (client.is_post_term) {
      notifications.push({
        id: `post-term-${client.id}`,
        type: "post_term",
        title: "Gestação Pós-Data",
        description: client.full_name,
        client,
        priority: "high",
        icon: AlertTriangle,
        color: "destructive"
      });
    } else {
      notifications.push({
        id: `birth-${client.id}`,
        type: "birth_approaching",
        title: "Parto se Aproximando",
        description: client.full_name,
        client,
        priority: client.current_weeks && client.current_weeks >= 39 ? "high" : "medium",
        icon: Baby,
        color: client.current_weeks && client.current_weeks >= 39 ? "warning" : "warning"
      });
    }
  });

  // Sort by priority
  notifications.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const isLoading = loadingBirth;
  const hasNotifications = notifications.length > 0;
  const highPriorityCount = notifications.filter(n => n.priority === "high").length;

  if (isLoading) {
    return (
      <Card className="card-glass h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Notificações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-glass h-full flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {highPriorityCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <CardTitle className="text-base font-semibold">Notificações</CardTitle>
            </div>
            {hasNotifications && (
              <Badge variant="secondary" className="text-xs">
                {notifications.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Tudo em dia!</p>
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[300px] lg:max-h-[400px] px-4 pb-4">
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      notification.priority === "high"
                        ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                        : notification.priority === "medium"
                        ? "bg-warning/5 border-warning/20 hover:bg-warning/10"
                        : "bg-muted/30 border-border/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.priority === "high"
                          ? "bg-destructive/15"
                          : notification.priority === "medium"
                          ? "bg-warning/15"
                          : "bg-muted"
                      }`}>
                        <notification.icon className={`h-4 w-4 ${
                          notification.priority === "high"
                            ? "text-destructive"
                            : notification.priority === "medium"
                            ? "text-warning"
                            : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium ${
                            notification.priority === "high"
                              ? "text-destructive"
                              : notification.priority === "medium"
                              ? "text-warning"
                              : "text-muted-foreground"
                          }`}>
                            {notification.title}
                          </span>
                          {notification.client && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 h-4 border-0 ${
                                notification.client.is_post_term
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-warning/20 text-warning"
                              }`}
                            >
                              {notification.client.current_weeks}s{notification.client.current_days && notification.client.current_days > 0 ? `${notification.client.current_days}d` : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">
                          {notification.description}
                        </p>
                        {notification.client?.dpp && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            DPP: {format(parseISO(notification.client.dpp), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      {notification.client && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs hover:bg-primary/10 flex-shrink-0"
                          onClick={() => handleRegisterBirth(notification.client as Client)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Nasceu
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <BirthRegistrationDialog
        open={birthDialogOpen}
        onOpenChange={setBirthDialogOpen}
        client={selectedClient}
      />
    </>
  );
}
