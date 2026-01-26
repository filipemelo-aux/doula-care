import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Loader2,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { formatBrazilDateTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"client_notifications">;

export default function GestanteMessages() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { client } = useGestanteAuth();

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

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("client_notifications")
        .update({ read: true })
        .eq("id", notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <GestanteLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
        ) : notifications.length === 0 ? (
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
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all ${
                    notification.read 
                      ? "bg-background" 
                      : "bg-primary/5 border-primary/20 shadow-sm"
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {notification.read ? (
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
