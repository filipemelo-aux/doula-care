import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PeriodOption, getPeriodDates } from "@/components/dashboard/PeriodFilter";

export interface FinancialMetrics {
  // Core totals
  totalContracted: number;       // Total valor contratado (plan_value de clientes)
  totalIncome: number;           // Total receitas registradas
  totalReceived: number;         // Receitas efetivamente recebidas (amount_received)
  totalPending: number;          // Receitas pendentes
  totalExpenses: number;         // Total despesas
  balance: number;               // Saldo = recebido - despesas

  // Business intelligence
  averageTicket: number;         // Ticket médio por cliente
  monthlyAverageRevenue: number; // Receita média mensal
  defaultRate: number;           // Taxa de inadimplência (%)

  // Client counts
  totalClients: number;
  gestantes: number;
  puerperas: number;

  // Breakdowns
  incomeByMethod: Record<string, number>;
  expensesByCategory: Record<string, number>;
  transactionCount: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export { formatCurrency };

export function useFinancialMetrics(period?: PeriodOption) {
  return useQuery({
    queryKey: ["financial-metrics", period || "all"],
    queryFn: async (): Promise<FinancialMetrics> => {
      // Fetch clients and all transactions in parallel
      const [clientsResult, allTransactionsResult, periodTransactionsResult] = await Promise.all([
        supabase.from("clients").select("id, status, payment_status, plan_value"),
        supabase.from("transactions").select("type, amount, amount_received, date, payment_method, expense_category"),
        period ? (async () => {
          const { start, end } = getPeriodDates(period);
          return supabase
            .from("transactions")
            .select("type, amount, amount_received, payment_method, expense_category")
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd"));
        })() : Promise.resolve(null),
      ]);

      const clients = clientsResult.data || [];
      const allTransactions = allTransactionsResult.data || [];
      const periodTransactions = periodTransactionsResult?.data || allTransactions;

      // Client counts
      const totalClients = clients.length;
      const gestantes = clients.filter((c) => c.status === "gestante").length;
      const puerperas = clients.filter((c) => c.status === "lactante").length;

      // Total contracted value from clients
      const totalContracted = clients.reduce((sum, c) => sum + Number(c.plan_value || 0), 0);

      // Period-based financial calculations
      const incomeTransactions = periodTransactions.filter((t) => t.type === "receita");
      const expenseTransactions = periodTransactions.filter((t) => t.type === "despesa");

      const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalReceived = incomeTransactions.reduce((sum, t) => sum + Number(t.amount_received || 0), 0);
      const totalPending = totalIncome - totalReceived;
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const balance = totalReceived - totalExpenses;

      // Business intelligence
      const clientsWithRevenue = clients.filter((c) => Number(c.plan_value || 0) > 0).length;
      const averageTicket = clientsWithRevenue > 0 ? totalContracted / clientsWithRevenue : 0;

      // Monthly average: group all-time income by month
      const monthlyTotals: Record<string, number> = {};
      allTransactions
        .filter((t) => t.type === "receita")
        .forEach((t) => {
          const month = t.date?.substring(0, 7) || "unknown";
          monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(t.amount_received || 0);
        });
      const months = Object.keys(monthlyTotals).length;
      const monthlyAverageRevenue = months > 0
        ? Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / months
        : 0;

      // Default rate: pending / total contracted
      const defaultRate = totalContracted > 0
        ? ((totalContracted - totalReceived) / totalContracted) * 100
        : 0;

      // Income by payment method
      const incomeByMethod: Record<string, number> = {};
      incomeTransactions.forEach((t) => {
        const method = t.payment_method || "pix";
        incomeByMethod[method] = (incomeByMethod[method] || 0) + Number(t.amount);
      });

      // Expenses by category
      const expensesByCategory: Record<string, number> = {};
      expenseTransactions.forEach((t) => {
        const category = t.expense_category || "outros";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(t.amount);
      });

      return {
        totalContracted,
        totalIncome,
        totalReceived,
        totalPending: Math.max(0, totalPending),
        totalExpenses,
        balance,
        averageTicket,
        monthlyAverageRevenue,
        defaultRate: Math.min(100, Math.max(0, defaultRate)),
        totalClients,
        gestantes,
        puerperas,
        incomeByMethod,
        expensesByCategory,
        transactionCount: periodTransactions.length,
      };
    },
  });
}
