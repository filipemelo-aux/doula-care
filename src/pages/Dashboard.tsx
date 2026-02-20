import { useState } from "react";
import { useFinancialMetrics, formatCurrency } from "@/hooks/useFinancialMetrics";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentClients } from "@/components/dashboard/RecentClients";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { TopPlansCard } from "@/components/dashboard/TopPlansCard";
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";
import { PeriodFilter, PeriodOption } from "@/components/dashboard/PeriodFilter";
import { ClientsListDialog } from "@/components/dashboard/ClientsListDialog";
import { Users, Baby, Heart, Wallet, TrendingUp, BarChart3, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [gestantesDialogOpen, setGestantesDialogOpen] = useState(false);
  const [puerperasDialogOpen, setPuerperasDialogOpen] = useState(false);

  const { data: metrics } = useFinancialMetrics(period);

  return (
    <div className="space-y-4 lg:space-y-6 overflow-x-hidden">
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
          title="Receita Contratada"
          value={formatCurrency(metrics?.totalContracted || 0)}
          subtitle={`${formatCurrency(metrics?.totalPending || 0)} pendente`}
          icon={Wallet}
          variant="success"
        />
      </div>

      {/* Stats Grid - Row 2: Business Intelligence */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
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
        <StatCard
          title="Inadimplência"
          value={`${(metrics?.defaultRate || 0).toFixed(1)}%`}
          subtitle="Pendente / contratado"
          icon={AlertTriangle}
          variant={(metrics?.defaultRate || 0) > 30 ? "primary" : undefined}
        />
      </div>

      {/* Notifications Center */}
      <NotificationsCenter />

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
    </div>
  );
}
