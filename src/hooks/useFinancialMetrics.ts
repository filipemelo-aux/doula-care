import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PeriodOption, getPeriodDates } from "@/components/dashboard/PeriodFilter";

export interface FinancialMetrics {
  // Core totals (all sourced from transactions table, matching Financial.tsx)
  totalContracted: number;       // Total valor contratado = sum(transactions.amount) type=receita
  totalIncome: number;           // Same as totalContracted for receitas
  totalReceived: number;         // sum(transactions.amount_received) type=receita
  totalPending: number;          // totalContracted - totalReceived
  totalExpenses: number;         // sum(transactions.amount) type=despesa
  balance: number;               // totalReceived - totalExpenses

  // Business intelligence
  averageTicket: number;         // Ticket médio por cliente
  monthlyAverageRevenue: number; // Receita média mensal
  defaultRate: number;           // Taxa de inadimplência (%)

  // Client counts
  totalClients: number;
  gestantes: number;
  puerperas: number;
  outros: number;

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
      // Fetch all data in parallel
      const [
        clientsResult,
        allTransactionsResult,
        periodTransactionsResult,
      ] = await Promise.all([
        supabase.from("clients").select("id, status, payment_status, plan_value"),
        supabase.from("transactions").select("type, amount, amount_received, date, payment_method, expense_category, is_auto_generated"),
        period ? (async () => {
          const { start, end } = getPeriodDates(period);
          return supabase
            .from("transactions")
            .select("type, amount, amount_received, payment_method, expense_category, is_auto_generated, date")
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
      const outros = clients.filter((c) => c.status === "outro" || c.status === "tentante").length;

      // ── All financial totals use period-filtered transactions
      const incomeTransactions = periodTransactions.filter((t) => t.type === "receita");
      const expenseTransactions = periodTransactions.filter((t) => t.type === "despesa");

      // Total contracted = sum of income transaction amounts in the period
      const totalContracted = incomeTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const totalIncome = totalContracted;

      // Total received = sum of amount_received from income transactions in the period
      const totalReceived = incomeTransactions.reduce((sum, t) => sum + Number(t.amount_received || 0), 0);

      // Pending = contracted - received (per-transaction to avoid negative)
      const totalPending = incomeTransactions.reduce((sum, t) => {
        const total = Number(t.amount || 0);
        const received = Number(t.amount_received || 0);
        return sum + Math.max(0, total - received);
      }, 0);

      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const balance = totalReceived - totalExpenses;

      // Business intelligence
      const clientsWithRevenue = clients.filter((c) => Number(c.plan_value || 0) > 0).length;
      const clientPlanTotal = clients.reduce((sum, c) => sum + Number(c.plan_value || 0), 0);
      const averageTicket = clientsWithRevenue > 0 ? clientPlanTotal / clientsWithRevenue : 0;

      // Monthly average revenue (period-based, matches top KPI scope)
      const monthsInPeriod = period === "year" ? 12 : period === "semester" ? 6 : period === "quarter" ? 3 : 1;
      const monthlyAverageRevenue = period
        ? totalReceived / monthsInPeriod
        : (() => {
            const monthlyTotals: Record<string, number> = {};
            allTransactions
              .filter((t) => t.type === "receita")
              .forEach((t) => {
                const month = t.date?.substring(0, 7) || "unknown";
                monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(t.amount_received || 0);
              });
            const months = Object.keys(monthlyTotals).length;
            return months > 0 ? Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / months : 0;
          })();

      // Default rate: pending / total contracted
      const defaultRate = totalContracted > 0
        ? (totalPending / totalContracted) * 100
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
        outros,
        incomeByMethod,
        expensesByCategory,
        transactionCount: periodTransactions.length,
      };
    },
  });
}
