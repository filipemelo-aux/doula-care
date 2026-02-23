import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeBanner } from "@/components/plan/UpgradeBanner";
import { useFinancialMetrics, formatCurrency } from "@/hooks/useFinancialMetrics";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  FileText,
  DollarSign,
  Download,
  Loader2,
  BarChart3,
  Wallet,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PeriodFilter, PeriodOption, getPeriodDates, getPeriodLabel } from "@/components/dashboard/PeriodFilter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportReport, type ReportTab, type ExportFormat } from "@/services/reportExport";
import { toast } from "sonner";

const COLORS = [
  "hsl(16 75% 44%)",
  "hsl(142 71% 45%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(270 60% 60%)",
  "hsl(350 65% 55%)",
];

export default function Reports() {
  const [period, setPeriod] = useState<PeriodOption>("semester");
  const [activeTab, setActiveTab] = useState<ReportTab>("financeiro");
  const [exporting, setExporting] = useState(false);
  const { plan, limits } = usePlanLimits();
  const { data: metrics } = useFinancialMetrics(period);

  if (!limits.reports) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Relatórios</h1>
          <p className="page-description">Visualize o desempenho do seu negócio em detalhes</p>
        </div>
        <UpgradeBanner feature="Relatórios avançados" currentPlan={plan} requiredPlan="pro" />
      </div>
    );
  }

  const handleExport = async (fmt: ExportFormat) => {
    try {
      setExporting(true);
      await exportReport(activeTab, period, fmt);
      toast.success("Relatório exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar relatório");
    } finally {
      setExporting(false);
    }
  };

  // Monthly chart data
  const { data: monthlyData } = useQuery({
    queryKey: ["monthly-report", period],
    queryFn: async () => {
      const monthCount = period === "year" ? 12 : period === "semester" ? 6 : period === "quarter" ? 3 : 1;
      const months = [];

      for (let i = monthCount - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const { data: transactions } = await supabase
          .from("transactions")
          .select("*")
          .gte("date", format(start, "yyyy-MM-dd"))
          .lte("date", format(end, "yyyy-MM-dd"));

        const income = transactions?.filter((t) => t.type === "receita").reduce((sum, t) => sum + Number(t.amount_received || 0), 0) || 0;
        const contracted = transactions?.filter((t) => t.type === "receita").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expenses = transactions?.filter((t) => t.type === "despesa").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        months.push({
          month: format(date, "MMM", { locale: ptBR }),
          fullMonth: format(date, "MMMM yyyy", { locale: ptBR }),
          recebido: income,
          contratado: contracted,
          despesas: expenses,
          saldo: income - expenses,
        });
      }
      return months;
    },
  });

  // Client statistics
  const { data: clientStats } = useQuery({
    queryKey: ["client-stats-report"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("status, plan");
      const statusCounts = { tentante: 0, gestante: 0, lactante: 0 };
      const planCounts = { basico: 0, intermediario: 0, completo: 0 };
      data?.forEach((c) => {
        if (c.status) statusCounts[c.status as keyof typeof statusCounts]++;
        if (c.plan) planCounts[c.plan as keyof typeof planCounts]++;
      });
      return {
        byStatus: [
          { name: "Tentantes", value: statusCounts.tentante, color: "hsl(199 89% 48%)" },
          { name: "Gestantes", value: statusCounts.gestante, color: "hsl(16 75% 44%)" },
          { name: "Lactantes", value: statusCounts.lactante, color: "hsl(142 71% 45%)" },
        ].filter((i) => i.value > 0),
        byPlan: [
          { name: "Básico", value: planCounts.basico, color: "hsl(199 89% 48%)" },
          { name: "Intermediário", value: planCounts.intermediario, color: "hsl(38 92% 50%)" },
          { name: "Completo", value: planCounts.completo, color: "hsl(16 75% 44%)" },
        ].filter((i) => i.value > 0),
        total: data?.length || 0,
      };
    },
  });

  // Income by payment method
  const { data: incomeByMethod } = useQuery({
    queryKey: ["income-by-method", period],
    queryFn: async () => {
      const { start, end } = getPeriodDates(period);
      const { data } = await supabase
        .from("transactions")
        .select("payment_method, amount")
        .eq("type", "receita")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      const methods: Record<string, number> = {};
      data?.forEach((t) => {
        const m = t.payment_method || "pix";
        methods[m] = (methods[m] || 0) + Number(t.amount);
      });

      const labels: Record<string, string> = { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", transferencia: "Transf.", boleto: "Boleto" };
      return Object.entries(methods)
        .map(([k, v]) => ({ name: labels[k] || k, value: v }))
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value);
    },
  });

  // Expenses by category
  const { data: expensesByCategory } = useQuery({
    queryKey: ["expenses-by-category", period],
    queryFn: async () => {
      const { start, end } = getPeriodDates(period);
      const { data } = await supabase
        .from("transactions")
        .select("expense_category, expense_type, amount")
        .eq("type", "despesa")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      const categories: Record<string, number> = {};
      const types: Record<string, number> = {};
      data?.forEach((e) => {
        const cat = e.expense_category || "outros";
        const tp = e.expense_type || "material_trabalho";
        categories[cat] = (categories[cat] || 0) + Number(e.amount);
        types[tp] = (types[tp] || 0) + Number(e.amount);
      });

      const catLabels: Record<string, string> = {
        social_media: "Social Media", filmmaker: "Filmmaker", marketing: "Marketing",
        material_hospitalar: "Mat. Hospitalar", material_escritorio: "Mat. Escritório",
        transporte: "Transporte", formacao: "Formação", equipamentos: "Equipamentos",
        servicos_terceiros: "Serv. Terceiros", outros: "Outros",
      };
      const typeLabels: Record<string, string> = { material_trabalho: "Material de Trabalho", servicos_contratados: "Serviços Contratados" };

      return {
        byCategory: Object.entries(categories).map(([k, v]) => ({ name: catLabels[k] || k, value: v })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value),
        byType: Object.entries(types).map(([k, v]) => ({ name: typeLabels[k] || k, value: v })).filter((i) => i.value > 0),
        total: data?.reduce((s, t) => s + Number(t.amount), 0) || 0,
      };
    },
  });

  // Monthly table data
  const { data: monthlyTableData } = useQuery({
    queryKey: ["monthly-table-report"],
    queryFn: async () => {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const { data: transactions } = await supabase
          .from("transactions")
          .select("*")
          .gte("date", format(start, "yyyy-MM-dd"))
          .lte("date", format(end, "yyyy-MM-dd"));

        const contracted = transactions?.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0) || 0;
        const received = transactions?.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount_received || 0), 0) || 0;
        const expenses = transactions?.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0) || 0;

        months.push({
          month: format(date, "MMMM yyyy", { locale: ptBR }),
          monthShort: format(date, "MMM yy", { locale: ptBR }),
          contracted,
          received,
          expenses,
          balance: received - expenses,
          count: transactions?.length || 0,
        });
      }
      return months;
    },
  });

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    fontSize: "12px",
  };

  return (
    <div className="space-y-4 lg:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-3xl font-semibold text-foreground">Relatórios</h1>
            <p className="text-xs lg:text-sm text-muted-foreground">Desempenho do seu negócio</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PeriodFilter selected={period} onChange={setPeriod} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileText className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  <FileText className="w-4 h-4 mr-2" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* KPI Cards - 2 rows of 3 on mobile, 6 cols on desktop */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
        <KpiCard
          label="Contratado"
          value={formatCurrency(metrics?.totalContracted || 0)}
          icon={<Target className="w-4 h-4 text-primary" />}
          color="primary"
        />
        <KpiCard
          label="Recebido"
          value={formatCurrency(metrics?.totalReceived || 0)}
          icon={<TrendingUp className="w-4 h-4 text-success" />}
          color="success"
        />
        <KpiCard
          label="Pendente"
          value={formatCurrency(metrics?.totalPending || 0)}
          icon={<Wallet className="w-4 h-4 text-warning" />}
          color="warning"
        />
        <KpiCard
          label="Despesas"
          value={formatCurrency(metrics?.totalExpenses || 0)}
          icon={<TrendingDown className="w-4 h-4 text-destructive" />}
          color="destructive"
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(metrics?.averageTicket || 0)}
          icon={<BarChart3 className="w-4 h-4 text-info" />}
          color="info"
        />
        <KpiCard
          label="Inadimplência"
          value={`${(metrics?.defaultRate || 0).toFixed(0)}%`}
          icon={<Percent className="w-4 h-4 text-muted-foreground" />}
          color={(metrics?.defaultRate || 0) > 30 ? "destructive" : "success"}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financeiro" onValueChange={(v) => setActiveTab(v as ReportTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financeiro" className="text-xs lg:text-sm gap-1 lg:gap-2 px-1 lg:px-3">
            <DollarSign className="w-3.5 h-3.5 lg:w-4 lg:h-4 flex-shrink-0" />
            <span className="truncate">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="text-xs lg:text-sm gap-1 lg:gap-2 px-1 lg:px-3">
            <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 flex-shrink-0" />
            <span className="truncate">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="receitas" className="text-xs lg:text-sm gap-1 lg:gap-2 px-1 lg:px-3">
            <CreditCard className="w-3.5 h-3.5 lg:w-4 lg:h-4 flex-shrink-0" />
            <span className="truncate">Receitas</span>
          </TabsTrigger>
          <TabsTrigger value="despesas" className="text-xs lg:text-sm gap-1 lg:gap-2 px-1 lg:px-3">
            <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4 flex-shrink-0" />
            <span className="truncate">Despesas</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════ FINANCEIRO ═══════ */}
        <TabsContent value="financeiro" className="space-y-4">
          {/* Evolution Chart */}
          <Card className="card-glass">
            <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
              <CardTitle className="text-sm lg:text-lg font-semibold text-foreground">
                Evolução Financeira — {getPeriodLabel(period)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 lg:px-6 pb-4">
              {monthlyData && monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyData} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRecebido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v)
                      }
                      width={55}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Area type="monotone" dataKey="recebido" name="Recebido" stroke="hsl(142 71% 45%)" strokeWidth={2} fillOpacity={1} fill="url(#gRecebido)" />
                    <Area type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0 72% 51%)" strokeWidth={2} fillOpacity={1} fill="url(#gDespesas)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Sem dados suficientes para exibir" />
              )}
            </CardContent>
          </Card>

          {/* Monthly Table - Mobile cards / Desktop table */}
          <Card className="card-glass">
            <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
              <CardTitle className="text-sm lg:text-lg font-semibold text-foreground">
                Relatório Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 lg:px-6 pb-4">
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-2">
                {monthlyTableData?.map((row) => (
                  <div key={row.month} className="rounded-lg border border-border/50 p-3 space-y-2 bg-card/50">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-xs capitalize text-foreground">{row.monthShort}</p>
                      <span className="text-[10px] text-muted-foreground">{row.count} mov.</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <MetricCell label="Contrat." value={row.contracted} color="text-foreground" />
                      <MetricCell label="Receb." value={row.received} color="text-success" />
                      <MetricCell label="Desp." value={row.expenses} color="text-destructive" />
                      <MetricCell label="Saldo" value={row.balance} color={row.balance >= 0 ? "text-success" : "text-destructive"} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Mês</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Contratado</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Recebido</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Despesas</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Saldo</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Mov.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTableData?.map((row) => (
                      <tr key={row.month} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 font-medium capitalize">{row.month}</td>
                        <td className="text-right py-2.5">{formatCurrency(row.contracted)}</td>
                        <td className="text-right py-2.5 text-success font-medium">{formatCurrency(row.received)}</td>
                        <td className="text-right py-2.5 text-destructive">{formatCurrency(row.expenses)}</td>
                        <td className={`text-right py-2.5 font-semibold ${row.balance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="text-right py-2.5 text-muted-foreground">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ CLIENTES ═══════ */}
        <TabsContent value="clientes" className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg lg:text-2xl font-bold text-foreground">{clientStats?.total || 0}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Gestantes</p>
                <p className="text-lg lg:text-2xl font-bold text-primary">{metrics?.gestantes || 0}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Lactantes</p>
                <p className="text-lg lg:text-2xl font-bold text-success">{metrics?.puerperas || 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Distribution */}
            <Card className="card-glass">
              <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
                <CardTitle className="text-sm lg:text-lg font-semibold">Por Status</CardTitle>
              </CardHeader>
              <CardContent className="px-1 lg:px-6 pb-4">
                {clientStats?.byStatus && clientStats.byStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={clientStats.byStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {clientStats.byStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState text="Sem clientes cadastrados" />
                )}
              </CardContent>
            </Card>

            {/* Plan Distribution */}
            <Card className="card-glass">
              <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
                <CardTitle className="text-sm lg:text-lg font-semibold">Por Plano</CardTitle>
              </CardHeader>
              <CardContent className="px-3 lg:px-6 pb-4">
                {clientStats?.byPlan && clientStats.byPlan.length > 0 ? (
                  <div className="space-y-3">
                    {clientStats.byPlan.map((plan) => {
                      const pct = clientStats.total > 0 ? (plan.value / clientStats.total) * 100 : 0;
                      return (
                        <div key={plan.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">{plan.name}</span>
                            <span className="text-muted-foreground">
                              {plan.value} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: plan.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState text="Sem clientes cadastrados" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ RECEITAS ═══════ */}
        <TabsContent value="receitas" className="space-y-4">
          {/* Income summary strip */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">Contratado</p>
                <p className="text-sm lg:text-lg font-bold text-foreground">{formatCurrency(metrics?.totalIncome || 0)}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">Recebido</p>
                <p className="text-sm lg:text-lg font-bold text-success">{formatCurrency(metrics?.totalReceived || 0)}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">Média/Mês</p>
                <p className="text-sm lg:text-lg font-bold text-primary">{formatCurrency(metrics?.monthlyAverageRevenue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-glass">
            <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
              <CardTitle className="text-sm lg:text-lg font-semibold">
                Por Forma de Pagamento — {getPeriodLabel(period)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 lg:px-6 pb-4">
              {incomeByMethod && incomeByMethod.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={incomeByMethod}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {incomeByMethod.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 px-2 lg:px-0">
                    {incomeByMethod.map((method, i) => (
                      <div key={method.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs lg:text-sm font-medium truncate">{method.name}</span>
                        </div>
                        <span className="text-xs lg:text-sm font-semibold text-success flex-shrink-0 ml-2">
                          {formatCurrency(method.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="Sem receitas no período" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ DESPESAS ═══════ */}
        <TabsContent value="despesas" className="space-y-4">
          {/* Expense summary */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">Total Despesas</p>
                <p className="text-sm lg:text-lg font-bold text-destructive">{formatCurrency(expensesByCategory?.total || 0)}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">Categorias</p>
                <p className="text-sm lg:text-lg font-bold text-foreground">{expensesByCategory?.byCategory?.length || 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chart */}
            <Card className="card-glass">
              <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
                <CardTitle className="text-sm lg:text-lg font-semibold">Por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="px-1 lg:px-6 pb-4">
                {expensesByCategory?.byCategory && expensesByCategory.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {expensesByCategory.byCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState text="Sem despesas registradas" />
                )}
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card className="card-glass">
              <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
                <CardTitle className="text-sm lg:text-lg font-semibold">Detalhamento</CardTitle>
              </CardHeader>
              <CardContent className="px-3 lg:px-6 pb-4">
                {expensesByCategory?.byCategory && expensesByCategory.byCategory.length > 0 ? (
                  <div className="space-y-3">
                    {expensesByCategory.byCategory.map((cat, i) => {
                      const pct = (cat.value / expensesByCategory.total) * 100;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs lg:text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="font-medium truncate">{cat.name}</span>
                            </div>
                            <span className="text-destructive font-semibold flex-shrink-0 ml-2">
                              {formatCurrency(cat.value)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-border mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Total</span>
                        <span className="text-base font-bold text-destructive">
                          {formatCurrency(expensesByCategory.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState text="Sem despesas registradas" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* By Type */}
          {expensesByCategory?.byType && expensesByCategory.byType.length > 0 && (
            <Card className="card-glass">
              <CardHeader className="pb-2 px-3 lg:px-6 pt-4 lg:pt-6">
                <CardTitle className="text-sm lg:text-lg font-semibold">Por Tipo</CardTitle>
              </CardHeader>
              <CardContent className="px-3 lg:px-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {expensesByCategory.byType.map((type) => (
                    <div key={type.name} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                      <span className="text-xs lg:text-sm font-medium text-foreground truncate">{type.name}</span>
                      <span className="text-sm lg:text-base font-semibold text-destructive flex-shrink-0 ml-2">
                        {formatCurrency(type.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Helper Components ────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="card-glass overflow-hidden">
      <CardContent className="p-2.5 lg:p-4">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-[10px] lg:text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <p className="text-xs lg:text-base font-bold text-foreground truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className={`text-xs font-semibold truncate ${color}`}>
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(value)}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground text-sm">{text}</div>
  );
}
