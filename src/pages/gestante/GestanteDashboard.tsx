import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Heart, 
  Baby, 
  Calendar, 
  Loader2,
  BookHeart,
  MessageCircle,
  ChevronRight,
  Timer,
  LogOut,
  Sparkles,
  Scale,
  Ruler,
  Clock,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { getLocalDate } from "@/lib/utils";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { useNavigate } from "react-router-dom";
import { LaborStartButton } from "@/components/gestante/LaborStartButton";

import { AppointmentsCard } from "@/components/gestante/AppointmentsCard";
import { ScheduledServicesCard } from "@/components/gestante/ScheduledServicesCard";
import { OverduePaymentAlert } from "@/components/gestante/OverduePaymentAlert";


type Client = Tables<"clients">;

export default function GestanteDashboard() {
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [preferredName, setPreferredName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { client, user, signOut } = useGestanteAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchFullClientData();
      fetchUnreadCount();
      checkPaymentMessages();
      // Fetch avatar
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setAvatarUrl(data?.avatar_url || null));
    }
  }, [user]);

  // Listen for realtime updates to this client's record (e.g., doula registering labor)
  useEffect(() => {
    if (!client?.id) return;

    const channel = supabase
      .channel(`client-updates-${client.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clients",
          filter: `id=eq.${client.id}`,
        },
        (payload) => {
          setClientData(payload.new as Client);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client?.id]);

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
      if (data) {
        setPreferredName((data as any).preferred_name || null);
      }
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
        .eq("read_by_client", false);

      if (error) throw error;
      setUnreadMessages(count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Check for unread payment messages and redirect if found
  const checkPaymentMessages = async () => {
    if (!client?.id) return;

    try {
      const { count, error } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("read_by_client", false)
        .or("title.like.💰%,title.like.🚨 Pagamento%");

      if (error) throw error;
      if ((count || 0) > 0) {
        navigate("/gestante/mensagens", { replace: true });
      }
    } catch (error) {
      console.error("Error checking payment messages:", error);
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

  const calculateBabyAge = () => {
    if (!clientData?.birth_date) return null;
    
    const birthDate = getLocalDate(clientData.birth_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysOld = differenceInDays(today, birthDate);
    
    if (daysOld < 0) return null;
    
    const weeks = Math.floor(daysOld / 7);
    const days = daysOld % 7;
    
    return { weeks, days, daysOld };
  };

  const gestationalAge = calculateGestationalAge();
  const babyAge = calculateBabyAge();
  const isPuerpera = clientData?.status === "lactante" && clientData?.birth_occurred;

  const { data: orgServices } = useQuery({
    queryKey: ["dashboard-org-services", clientData?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_services")
        .select("name")
        .eq("organization_id", clientData!.organization_id!)
        .eq("is_active", true)
        .limit(2);
      return data ?? [];
    },
    enabled: !!clientData?.organization_id,
  });

  const serviceExamples = orgServices && orgServices.length > 0
    ? orgServices.map(s => s.name).join(", ") + "..."
    : "Solicitar e acompanhar";

  const displayName = preferredName || client?.full_name?.split(" ")[0] || "";

  if (loading) {
    return (
      <GestanteLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GestanteLayout>
    );
  }

  // Puérpera View - After birth
  if (isPuerpera) {
    const babyNames = clientData?.baby_names as string[] | null;
    const babyName = babyNames && babyNames.length > 0 ? babyNames[0] : "seu bebê";
    const multipleBabies = babyNames && babyNames.length > 1;

    return (
      <GestanteLayout>
        {/* Greeting for Puérpera */}
        <div className="bg-gradient-to-b from-primary/15 to-background px-4 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 shadow-md">
              <AvatarImage src={avatarUrl || undefined} alt="Perfil" className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
                <Baby className="w-5 h-5 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Mamãe,</p>
              <h1 className="font-display font-bold text-base">{displayName}!</h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Overdue Payment Alert */}
          <OverduePaymentAlert />

          {/* Congratulations Card */}
          <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-primary/20 to-accent/20 border-primary/30 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                  <Heart className="h-6 w-6 text-accent absolute -top-1 -right-1 animate-bounce" />
                </div>
              </div>
              <h2 className="font-display font-bold text-2xl text-primary mb-2">
                Parabéns, Mamãe! 🎉
              </h2>
              <p className="text-muted-foreground mb-4">
                {multipleBabies 
                  ? `Seus bebês ${babyNames?.join(" e ")} chegaram!`
                  : `${babyName} chegou ao mundo!`
                }
              </p>
              
              {/* Birth Details */}
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {clientData?.birth_date && (
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Nascimento</p>
                    <p className="font-semibold text-sm">
                      {format(getLocalDate(clientData.birth_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
                {clientData?.birth_time && (
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Hora</p>
                    <p className="font-semibold text-sm">{clientData.birth_time.slice(0, 5)}</p>
                  </div>
                )}
                {clientData?.birth_weight && (
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Scale className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Peso</p>
                    <p className="font-semibold text-sm">{clientData.birth_weight.toFixed(3)} kg</p>
                  </div>
                )}
                {clientData?.birth_height && (
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Ruler className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Estatura</p>
                    <p className="font-semibold text-sm">{clientData.birth_height} cm</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Baby Age Card */}
          {babyAge && (
            <Card className="overflow-hidden bg-gradient-to-br from-secondary to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Baby className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-base">
                    {multipleBabies ? "Seus Bebês" : babyName}
                  </h2>
                </div>
                
                <div className="text-center py-3">
                  {babyAge.weeks > 0 ? (
                    <p className="text-4xl font-display font-bold text-primary">
                      {babyAge.weeks}
                      <span className="text-2xl">s</span>
                      {babyAge.days > 0 && (
                        <span className="text-2xl">{babyAge.days}d</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-4xl font-display font-bold text-primary">
                      {babyAge.days}
                      <span className="text-2xl">d</span>
                    </p>
                  )}
                  <p className="text-muted-foreground text-sm mt-1">
                    {babyAge.weeks > 0 ? "semanas de vida" : "dias de vida"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions for Puérpera */}
          <div className="grid grid-cols-2 gap-3">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            onClick={() => navigate("/gestante/servicos")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Serviços</p>
                <p className="text-xs text-muted-foreground">{serviceExamples}</p>
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

          {/* Appointments */}
          {client?.id && <AppointmentsCard clientId={client.id} />}

          {/* Scheduled Services */}
          {client?.id && <ScheduledServicesCard clientId={client.id} />}




          {/* Welcome to Motherhood Message */}
          <Card className="bg-gradient-to-br from-secondary to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-accent mb-1">
                    Bem-vinda à maternidade!
                  </p>
                  <p className="text-xs text-accent/80">
                    Continue usando o app para registrar momentos especiais e manter contato com sua Doula nesta nova fase.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </GestanteLayout>
    );
  }

  // Gestante View - Before birth (original)
  return (
    <GestanteLayout>
      {/* Greeting */}
      <div className="bg-gradient-to-b from-primary/15 to-background px-4 lg:px-8 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 shadow-md">
            <AvatarImage src={avatarUrl || undefined} alt="Perfil" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
              <p className="text-xs text-muted-foreground">Olá,</p>
              <h1 className="font-display font-bold text-base">{displayName}!</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Overdue Payment Alert */}
        <OverduePaymentAlert />

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
            onClick={() => navigate("/gestante/servicos")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Serviços</p>
                <p className="text-xs text-muted-foreground">{serviceExamples}</p>
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

        {/* Contractions Card - only show if birth NOT registered */}
        {!isPuerpera && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-800"
            onClick={() => navigate("/gestante/contracoes")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                <Timer className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Contador de Contrações</p>
                <p className="text-xs text-muted-foreground">Registre e acompanhe suas contrações</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Appointments */}
        {client?.id && <AppointmentsCard clientId={client.id} />}

        {/* Scheduled Services */}
        {client?.id && <ScheduledServicesCard clientId={client.id} />}




        {/* Labor Started - Welcoming Message */}
        {clientData?.labor_started_at && (
          <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-primary/15 to-accent/15 border-primary/30 shadow-lg ring-2 ring-primary/20">
            <CardContent className="p-5 text-center space-y-3">
              <div className="flex justify-center">
                <div className="relative">
                  <Baby className="h-12 w-12 text-primary animate-pulse" />
                  <Heart className="h-5 w-5 text-accent absolute -top-1 -right-2 animate-bounce" />
                </div>
              </div>
              <h3 className="font-display font-bold text-lg text-primary">
                Seu bebê está a caminho! 💕
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Respire fundo, mamãe. Confie no seu corpo e no seu instinto. 
                Sua Doula está acompanhando tudo de perto e estará ao seu lado. 
                Cada contração te aproxima do momento mais lindo da sua vida. 🌸
              </p>
              <div 
                className="cursor-pointer bg-primary/10 rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                onClick={() => navigate("/gestante/contracoes")}
              >
                <Timer className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm text-primary">Registrar Contrações</span>
                <ChevronRight className="h-4 w-4 text-primary" />
              </div>
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