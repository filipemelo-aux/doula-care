import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Heart, 
  Baby, 
  Calendar, 
  Loader2,
  BookHeart,
  MessageCircle,
  ChevronRight,
  Timer,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { getLocalDate } from "@/lib/utils";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useNavigate } from "react-router-dom";
import { LaborStartButton } from "@/components/gestante/LaborStartButton";

type Client = Tables<"clients">;

export default function GestanteDashboard() {
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { client, user, signOut } = useGestanteAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchFullClientData();
      fetchUnreadCount();
    }
  }, [user]);

  const fetchFullClientData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setClientData(data);
    } catch (error) {
      console.error("Error fetching client:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!client?.id) return;

    try {
      const { count, error } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("read", false);

      if (error) throw error;
      setUnreadMessages(count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const calculateGestationalAge = () => {
    if (!clientData?.dpp) return null;
    
    const dppDate = getLocalDate(clientData.dpp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDpp = differenceInDays(dppDate, today);
    const totalDays = 280;
    const daysPregnant = totalDays - daysUntilDpp;
    
    if (daysPregnant < 0 || daysPregnant > 294) return null;
    
    const weeks = Math.floor(daysPregnant / 7);
    const days = daysPregnant % 7;
    
    return { weeks, days, daysUntilDpp };
  };

  const gestationalAge = calculateGestationalAge();

  if (loading) {
    return (
      <GestanteLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GestanteLayout>
    );
  }

  return (
    <GestanteLayout>
      {/* Header */}
      <header className="bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Heart className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Olá,</p>
                <h1 className="font-display font-bold text-xl">{client?.full_name?.split(" ")[0]}!</h1>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Pregnancy Progress + Labor Button Row */}
        {gestationalAge && (
          <div className={`grid gap-4 ${gestationalAge.weeks >= 37 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Pregnancy Progress Card */}
            <Card className="overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Baby className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-base">Sua Gestação</h2>
                </div>
                
                <div className="text-center py-3">
                  <p className="text-4xl font-display font-bold text-primary">
                    {gestationalAge.weeks}
                    <span className="text-2xl">s</span>
                    {gestationalAge.days > 0 && (
                      <span className="text-2xl">{gestationalAge.days}d</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">semanas de gestação</p>
                </div>

                <div className="flex items-center justify-between bg-background/60 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">DPP:</span>
                  </div>
                  <span className="font-semibold">
                    {clientData?.dpp && format(getLocalDate(clientData.dpp), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {gestationalAge.daysUntilDpp > 0 && gestationalAge.daysUntilDpp <= 60 && (
                  <div className="text-center mt-3 text-xs text-muted-foreground">
                    🎉 Faltam apenas <span className="font-semibold text-primary">{gestationalAge.daysUntilDpp}</span> dias!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Labor Start Button - Show for gestantes 37+ weeks */}
            {gestationalAge.weeks >= 37 && (
              <LaborStartButton 
                laborStarted={!!clientData?.labor_started_at}
                onLaborStarted={fetchFullClientData}
              />
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            onClick={() => navigate("/gestante/diario")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
                <BookHeart className="h-6 w-6 text-pink-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Diário</p>
                <p className="text-xs text-muted-foreground">Registrar momento</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] relative"
            onClick={() => navigate("/gestante/mensagens")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center relative">
                <MessageCircle className="h-6 w-6 text-blue-600" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadMessages}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Mensagens</p>
                <p className="text-xs text-muted-foreground">Da sua Doula</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Contractions Quick Access - Show if labor started */}
        {clientData?.labor_started_at && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200"
            onClick={() => navigate("/gestante/contracoes")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                <Timer className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-orange-800">Contador de Contrações</p>
                <p className="text-xs text-orange-600">Registre suas contrações agora</p>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-400" />
            </CardContent>
          </Card>
        )}

        {/* Welcome Message for new users */}
        {clientData && !clientData.dpp && (
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-4">
              <p className="text-sm text-yellow-800">
                <strong>Bem-vinda!</strong> Sua Doula em breve atualizará seu perfil com a data prevista do parto e outras informações importantes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </GestanteLayout>
  );
}
