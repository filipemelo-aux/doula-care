import { useState, useEffect } from "react";
import { useFinancialMetrics, formatCurrency } from "@/hooks/useFinancialMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentClients } from "@/components/dashboard/RecentClients";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { TopPlansCard } from "@/components/dashboard/TopPlansCard";
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { PeriodFilter, PeriodOption } from "@/components/dashboard/PeriodFilter";
import { ClientsListDialog } from "@/components/dashboard/ClientsListDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Baby, Heart, Wallet, TrendingUp, BarChart3, UserPlus } from "lucide-react";
import { AdminWelcomeDialog } from "@/components/dashboard/AdminWelcomeDialog";

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [gestantesDialogOpen, setGestantesDialogOpen] = useState(false);
  const [puerperasDialogOpen, setPuerperasDialogOpen] = useState(false);
  const [outrosDialogOpen, setOutrosDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const { profileName, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, welcome_seen")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAvatarUrl(data?.avatar_url || null);
        // Show welcome dialog only if never seen before
        if (data && !(data as any).welcome_seen) {
          setShowWelcome(true);
        }
      });
  }, [user]);

  const { data: metrics } = useFinancialMetrics(period);

  return (
    <div className="space-y-4 lg:space-y-6 overflow-x-hidden">
      {/* Greeting */}
      {profileName && (
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 shadow-md">
            <AvatarImage src={avatarUrl || undefined} alt="Perfil" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="font-display font-bold text-base">{profileName.split(" ")[0]}!</h1>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-description">
            Acompanhe suas clientes e o desempenho do seu negócio
          </p>
        </div>
        <PeriodFilter selected={period} onChange={setPeriod} />
      </div>

      {/* Stats Grid - Row 1: Clients */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          title="Total de Clientes"
          value={metrics?.totalClients || 0}
          subtitle="Clientes cadastradas"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Gestantes"
          value={metrics?.gestantes || 0}
          subtitle="Em acompanhamento"
          icon={Baby}
          onClick={() => setGestantesDialogOpen(true)}
        />
        <StatCard
          title="Puérperas"
          value={metrics?.puerperas || 0}
          subtitle="Pós-parto"
          icon={Heart}
          onClick={() => setPuerperasDialogOpen(true)}
        />
        <StatCard
          title="Outros"
          value={metrics?.outros || 0}
          subtitle="Outras clientes"
          icon={UserPlus}
          onClick={() => setOutrosDialogOpen(true)}
        />
      </div>

      {/* Stats Grid - Row 2: Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard
          title="Receita Contratada"
          value={formatCurrency(metrics?.totalContracted || 0)}
          subtitle={`${formatCurrency(metrics?.totalPending || 0)} pendente`}
          icon={Wallet}
          variant="success"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.averageTicket || 0)}
          subtitle="Por cliente"
          icon={BarChart3}
        />
        <StatCard
          title="Receita Média/Mês"
          value={formatCurrency(metrics?.monthlyAverageRevenue || 0)}
          subtitle="Média recebida"
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Notifications Center */}
      <NotificationsCenter />

      {/* Upcoming Appointments */}
      <UpcomingAppointments />

      {/* Financial Overview */}
      <FinancialOverview period={period} />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <RecentClients />
        <TopPlansCard />
      </div>

      {/* Dialogs */}
      <ClientsListDialog
        open={gestantesDialogOpen}
        onOpenChange={setGestantesDialogOpen}
        status="gestante"
      />
      <ClientsListDialog
        open={puerperasDialogOpen}
        onOpenChange={setPuerperasDialogOpen}
        status="lactante"
      />
      <ClientsListDialog
        open={outrosDialogOpen}
        onOpenChange={setOutrosDialogOpen}
        status="outro"
      />
      <AdminWelcomeDialog
        open={showWelcome}
        onClose={() => {
          setShowWelcome(false);
          if (user) {
            supabase
              .from("profiles")
              .update({ welcome_seen: true } as any)
              .eq("user_id", user.id)
              .then();
          }
        }}
        name={profileName}
      />
    </div>
  );
}
