import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
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
  LineChart,
  Line,
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
} from "lucide-react";
import { PeriodFilter, PeriodOption, getPeriodDates, getPeriodLabel } from "@/components/dashboard/PeriodFilter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLORS = ["hsl(350 65% 55%)", "hsl(142 71% 45%)", "hsl(18 60% 60%)", "hsl(199 89% 48%)", "hsl(38 92% 50%)", "hsl(270 60% 60%)"];

export default function Reports() {
  const [period, setPeriod] = useState<PeriodOption>("semester");

  // Get monthly data for charts
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

        const income =
          transactions
            ?.filter((t) => t.type === "receita")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const expenses =
          transactions
            ?.filter((t) => t.type === "despesa")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        months.push({
          month: format(date, "MMM", { locale: ptBR }),
          fullMonth: format(date, "MMMM yyyy", { locale: ptBR }),
          receitas: income,
          despesas: expenses,
          saldo: income - expenses,
        });
      }

      return months;
    },
  });

  // Get client statistics
  const { data: clientStats } = useQuery({
    queryKey: ["client-stats-report"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("status, plan");

      const statusCounts = { tentante: 0, gestante: 0, lactante: 0 };
      const planCounts = { basico: 0, intermediario: 0, completo: 0 };

      data?.forEach((client) => {
        if (client.status) statusCounts[client.status as keyof typeof statusCounts]++;
        if (client.plan) planCounts[client.plan as keyof typeof planCounts]++;
      });

      return {
        byStatus: [
          { name: "Tentantes", value: statusCounts.tentante, color: "hsl(199 89% 48%)" },
          { name: "Gestantes", value: statusCounts.gestante, color: "hsl(350 65% 55%)" },
          { name: "Lactantes", value: statusCounts.lactante, color: "hsl(142 71% 45%)" },
        ].filter((item) => item.value > 0),
        byPlan: [
          { name: "Básico", value: planCounts.basico, color: "hsl(199 89% 48%)" },
          { name: "Intermediário", value: planCounts.intermediario, color: "hsl(38 92% 50%)" },
          { name: "Completo", value: planCounts.completo, color: "hsl(350 65% 55%)" },
        ].filter((item) => item.value > 0),
        total: data?.length || 0,
      };
    },
  });

  // Get income by payment method
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
        const method = t.payment_method || "pix";
        methods[method] = (methods[method] || 0) + Number(t.amount);
      });

      const methodLabels: Record<string, string> = {
        pix: "PIX",
        cartao: "Cartão",
        dinheiro: "Dinheiro",
        transferencia: "Transferência",
        boleto: "Boleto",
      };

      return Object.entries(methods)
        .map(([key, value]) => ({
          name: methodLabels[key] || key,
          value,
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
    },
  });

  // Get expenses by category
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

      data?.forEach((expense) => {
        const category = expense.expense_category || "outros";
        const type = expense.expense_type || "material_trabalho";
        categories[category] = (categories[category] || 0) + Number(expense.amount);
        types[type] = (types[type] || 0) + Number(expense.amount);
      });

      const categoryLabels: Record<string, string> = {
        social_media: "Social Media",
        filmmaker: "Filmmaker",
        marketing: "Marketing",
        material_hospitalar: "Mat. Hospitalar",
        material_escritorio: "Mat. Escritório",
        transporte: "Transporte",
        formacao: "Formação",
        equipamentos: "Equipamentos",
        servicos_terceiros: "Serv. Terceiros",
        outros: "Outros",
      };

      const typeLabels: Record<string, string> = {
        material_trabalho: "Material de Trabalho",
        servicos_contratados: "Serviços Contratados",
      };

      return {
        byCategory: Object.entries(categories)
          .map(([key, value]) => ({
            name: categoryLabels[key] || key,
            value,
          }))
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value),
        byType: Object.entries(types)
          .map(([key, value]) => ({
            name: typeLabels[key] || key,
            value,
          }))
          .filter((item) => item.value > 0),
        total: data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
      };
    },
  });

  // Monthly financial table data
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

        const income = transactions?.filter((t) => t.type === "receita").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expenses = transactions?.filter((t) => t.type === "despesa").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        months.push({
          month: format(date, "MMMM yyyy", { locale: ptBR }),
          income,
          expenses,
          balance: income - expenses,
          transactionCount: transactions?.length || 0,
        });
      }
      return months;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totals = monthlyData?.reduce(
    (acc, month) => ({
      income: acc.income + month.receitas,
      expenses: acc.expenses + month.despesas,
    }),
    { income: 0, expenses: 0 }
  ) || { income: 0, expenses: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Relatórios</h1>
          <p className="page-description">
            Visualize o desempenho do seu negócio em detalhes
          </p>
        </div>
        <PeriodFilter selected={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-glass">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-xl font-semibold text-success">{formatCurrency(totals.income)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-xl font-semibold text-destructive">{formatCurrency(totals.expenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-xl font-semibold ${totals.income - totals.expenses >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(totals.income - totals.expenses)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-info/15 flex items-center justify-center">
              <Users className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-xl font-semibold text-foreground">{clientStats?.total || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different report views */}
      <Tabs defaultValue="financeiro" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="financeiro" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="receitas" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Receitas</span>
          </TabsTrigger>
          <TabsTrigger value="despesas" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Despesas</span>
          </TabsTrigger>
        </TabsList>

        {/* Financial Report Tab */}
        <TabsContent value="financeiro" className="space-y-6">
          {/* Evolution Chart */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Evolução Financeira - {getPeriodLabel(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData && monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          notation: "compact",
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="receitas" 
                      name="Receitas" 
                      stroke="hsl(142 71% 45%)" 
                      fillOpacity={1} 
                      fill="url(#colorReceitas)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="despesas" 
                      name="Despesas" 
                      stroke="hsl(0 72% 51%)" 
                      fillOpacity={1} 
                      fill="url(#colorDespesas)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Sem dados suficientes para exibir o gráfico
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Table */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Relatório Financeiro Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-3">
                {monthlyTableData?.map((row) => (
                  <Card key={row.month} className="p-3 space-y-2">
                    <p className="font-medium text-sm capitalize">{row.month}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Receitas</span>
                        <span className="font-medium text-success">{formatCurrency(row.income)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Despesas</span>
                        <span className="font-medium text-destructive">{formatCurrency(row.expenses)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Saldo</span>
                        <span className={`font-semibold ${row.balance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.balance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Transações</span>
                        <span className="font-medium">{row.transactionCount}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Transações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyTableData?.map((row) => (
                      <TableRow key={row.month} className="table-row-hover">
                        <TableCell className="font-medium capitalize">{row.month}</TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(row.income)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(row.expenses)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${row.balance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.balance)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.transactionCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients Report Tab */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Status Distribution */}
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Clientes por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientStats?.byStatus && clientStats.byStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={clientStats.byStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {clientStats.byStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Sem clientes cadastradas
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan Distribution */}
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Clientes por Plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientStats?.byPlan && clientStats.byPlan.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={clientStats.byPlan} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" name="Clientes" radius={[0, 4, 4, 0]}>
                          {clientStats.byPlan.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {clientStats.byPlan.map((plan) => (
                        <div key={plan.name} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                          <span className="text-sm text-muted-foreground">{plan.name}</span>
                          <span className="font-medium">{plan.value} cliente{plan.value !== 1 ? "s" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Sem clientes cadastradas
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Income Report Tab */}
        <TabsContent value="receitas" className="space-y-6">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Receitas por Forma de Pagamento - {getPeriodLabel(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomeByMethod && incomeByMethod.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={incomeByMethod}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {incomeByMethod.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {incomeByMethod.map((method, index) => (
                      <div
                        key={method.name}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{method.name}</span>
                        </div>
                        <span className="text-lg font-semibold text-success">
                          {formatCurrency(method.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Sem receitas registradas no período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Report Tab */}
        <TabsContent value="despesas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Despesas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategory?.byCategory && expensesByCategory.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {expensesByCategory.byCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Sem despesas registradas
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown list */}
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Detalhamento por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategory?.byCategory && expensesByCategory.byCategory.length > 0 ? (
                  <div className="space-y-3">
                    {expensesByCategory.byCategory.map((category, index) => {
                      const percentage = (category.value / expensesByCategory.total) * 100;
                      return (
                        <div key={category.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{category.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-destructive">
                              {formatCurrency(category.value)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-4 border-t border-border mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total de Despesas</span>
                        <span className="text-lg font-bold text-destructive">
                          {formatCurrency(expensesByCategory.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Sem despesas registradas
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* By Type */}
          {expensesByCategory?.byType && expensesByCategory.byType.length > 0 && (
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Despesas por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expensesByCategory.byType.map((type, index) => (
                    <div
                      key={type.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/10"
                    >
                      <span className="font-medium text-foreground">{type.name}</span>
                      <span className="text-xl font-semibold text-destructive">
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