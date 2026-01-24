import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentClients } from "@/components/dashboard/RecentClients";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { TopPlansCard } from "@/components/dashboard/TopPlansCard";
import { PeriodFilter, PeriodOption } from "@/components/dashboard/PeriodFilter";
import { Users, Baby, Heart, Wallet } from "lucide-react";

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodOption>("month");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clientsResult, transactionsResult] = await Promise.all([
        supabase.from("clients").select("status, payment_status, plan_value"),
        supabase.from("transactions").select("type, amount"),
      ]);

      const clients = clientsResult.data || [];
      const transactions = transactionsResult.data || [];

      const totalClients = clients.length;
      const gestantes = clients.filter((c) => c.status === "gestante").length;
      const lactantes = clients.filter((c) => c.status === "lactante").length;

      const totalIncome = transactions
        .filter((t) => t.type === "receita")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const pendingPayments = clients
        .filter((c) => c.payment_status === "pendente" || c.payment_status === "parcial")
        .reduce((sum, c) => sum + Number(c.plan_value || 0), 0);

      return {
        totalClients,
        gestantes,
        lactantes,
        totalIncome,
        pendingPayments,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-description">
            Acompanhe suas clientes e o desempenho do seu negócio
          </p>
        </div>
        <PeriodFilter selected={period} onChange={setPeriod} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Clientes"
          value={stats?.totalClients || 0}
          subtitle="Clientes cadastradas"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Gestantes"
          value={stats?.gestantes || 0}
          subtitle="Em acompanhamento"
          icon={Baby}
        />
        <StatCard
          title="Lactantes"
          value={stats?.lactantes || 0}
          subtitle="Pós-parto"
          icon={Heart}
        />
        <StatCard
          title="Receita Total"
          value={formatCurrency(stats?.totalIncome || 0)}
          subtitle={`${formatCurrency(stats?.pendingPayments || 0)} pendente`}
          icon={Wallet}
          variant="success"
        />
      </div>

      {/* Financial Overview with Period Filter */}
      <FinancialOverview period={period} />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentClients />
        <TopPlansCard />
      </div>
    </div>
  );
}
