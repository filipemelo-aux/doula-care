import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Heart, 
  Baby, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Bell, 
  LogOut,
  Loader2,
  Edit,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { EditContactDialog } from "@/components/gestante/EditContactDialog";

type Client = Tables<"clients">;
type Notification = Tables<"client_notifications">;

export default function GestanteDashboard() {
  const [client, setClient] = useState<Client | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClientData();
    fetchNotifications();
  }, []);

  const fetchClientData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/gestante/login");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Dados não encontrados");
        await supabase.auth.signOut();
        navigate("/gestante/login");
        return;
      }

      setClient(data);
    } catch (error) {
      console.error("Error fetching client:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clientData) return;

      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/gestante/login");
  };

  const calculateGestationalAge = () => {
    if (!client?.dpp) return null;
    
    const dppDate = new Date(client.dpp);
    const today = new Date();
    const daysUntilDpp = differenceInDays(dppDate, today);
    const totalDays = 280;
    const daysPregnant = totalDays - daysUntilDpp;
    
    if (daysPregnant < 0 || daysPregnant > 294) return null;
    
    const weeks = Math.floor(daysPregnant / 7);
    const days = daysPregnant % 7;
    
    return { weeks, days, daysUntilDpp };
  };

  const gestationalAge = calculateGestationalAge();

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pago: { variant: "default", label: "Pago" },
      pendente: { variant: "destructive", label: "Pendente" },
      parcial: { variant: "secondary", label: "Parcial" },
    };
    return variants[status] || variants.pendente;
  };

  const getPlanLabel = (plan: string) => {
    const plans: Record<string, string> = {
      basico: "Básico",
      intermediario: "Intermediário",
      completo: "Completo",
    };
    return plans[plan] || plan;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold">Olá, {client?.full_name.split(" ")[0]}!</h1>
              <p className="text-xs text-muted-foreground">Área da Gestante</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Pregnancy Progress Card */}
        {gestationalAge && (
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Baby className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Sua Gravidez</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-4xl font-display font-bold text-primary">
                  {gestationalAge.weeks}<span className="text-2xl">s</span>
                  {gestationalAge.days > 0 && (
                    <span className="text-2xl">{gestationalAge.days}d</span>
                  )}
                </p>
                <p className="text-muted-foreground">semanas de gestação</p>
              </div>

              <div className="flex items-center justify-between text-sm bg-background/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">DPP:</span>
                </div>
                <span className="font-medium">
                  {client?.dpp && format(new Date(client.dpp), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              {gestationalAge.daysUntilDpp > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  Faltam <span className="font-semibold text-foreground">{gestationalAge.daysUntilDpp}</span> dias para o parto previsto
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Seu Plano</CardTitle>
              </div>
              <Badge variant={getPaymentStatusBadge(client?.payment_status || "pendente").variant}>
                {getPaymentStatusBadge(client?.payment_status || "pendente").label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">{getPlanLabel(client?.plan || "basico")}</p>
                <p className="text-sm text-muted-foreground">Plano contratado</p>
              </div>
              {client?.plan_value && (
                <div className="text-right">
                  <p className="text-xl font-semibold text-primary">
                    R$ {client.plan_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">Valor total</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Seus Dados</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client?.phone || "Não informado"}</span>
            </div>
            {client?.street && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p>{client.street}{client.number && `, ${client.number}`}</p>
                  {client.neighborhood && <p className="text-sm text-muted-foreground">{client.neighborhood}</p>}
                  {client.city && client.state && (
                    <p className="text-sm text-muted-foreground">{client.city} - {client.state}</p>
                  )}
                </div>
              </div>
            )}
            {client?.companion_name && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Acompanhante</p>
                <p>{client.companion_name}</p>
                {client.companion_phone && (
                  <p className="text-sm text-muted-foreground">{client.companion_phone}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Mensagens da Doula</CardTitle>
              </div>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} nova{unreadCount > 1 ? "s" : ""}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma mensagem ainda
              </p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        notification.read 
                          ? "bg-background" 
                          : "bg-primary/5 border-primary/20"
                      }`}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        </div>
                        {notification.read ? (
                          <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>

      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={client}
        onUpdate={fetchClientData}
      />
    </div>
  );
}
