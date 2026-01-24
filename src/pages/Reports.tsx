import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";

const COLORS = ["#e85d7c", "#c9a86c", "#7fb88f", "#5b9bd5", "#9b87c4", "#f5a962"];

export default function Reports() {
  // Get last 6 months of data
  const { data: monthlyData } = useQuery({
    queryKey: ["monthly-report"],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
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
          receitas: income,
          despesas: expenses,
          saldo: income - expenses,
        });
      }

      return months;
    },
  });

  // Get client status distribution
  const { data: clientStats } = useQuery({
    queryKey: ["client-stats-report"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("status");

      const counts = {
        tentante: 0,
        gestante: 0,
        lactante: 0,
      };

      data?.forEach((client) => {
        if (client.status) {
          counts[client.status as keyof typeof counts]++;
        }
      });

      return [
        { name: "Tentantes", value: counts.tentante },
        { name: "Gestantes", value: counts.gestante },
        { name: "Lactantes", value: counts.lactante },
      ].filter((item) => item.value > 0);
    },
  });

  // Get plan distribution
  const { data: planStats } = useQuery({
    queryKey: ["plan-stats-report"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("plan");

      const counts = {
        basico: 0,
        intermediario: 0,
        completo: 0,
      };

      data?.forEach((client) => {
        if (client.plan) {
          counts[client.plan as keyof typeof counts]++;
        }
      });

      return [
        { name: "Básico", value: counts.basico },
        { name: "Intermediário", value: counts.intermediario },
        { name: "Completo", value: counts.completo },
      ].filter((item) => item.value > 0);
    },
  });

  // Get expense categories
  const { data: expenseCategories } = useQuery({
    queryKey: ["expense-categories-report"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("expense_category, amount")
        .eq("type", "despesa");

      const categories: Record<string, number> = {};

      data?.forEach((expense) => {
        const category = expense.expense_category || "outros";
        categories[category] = (categories[category] || 0) + Number(expense.amount);
      });

      const categoryLabels: Record<string, string> = {
        materiais: "Materiais",
        transporte: "Transporte",
        marketing: "Marketing",
        formacao: "Formação",
        equipamentos: "Equipamentos",
        outros: "Outros",
      };

      return Object.entries(categories)
        .map(([key, value]) => ({
          name: categoryLabels[key] || key,
          value,
        }))
        .filter((item) => item.value > 0);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-description">
          Visualize o desempenho do seu negócio
        </p>
      </div>

      {/* Financial Chart */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Evolução Financeira (Últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData && monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
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
                <Bar dataKey="receitas" name="Receitas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Sem dados suficientes para exibir o gráfico
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client Status */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Distribuição de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientStats && clientStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={clientStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {clientStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              Distribuição por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planStats && planStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={planStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {planStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Expense Categories */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategories && expenseCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {expenseCategories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Sem despesas registradas
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
