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
      // Build period payments query
      const periodPaymentsQuery = (() => {
        let q = supabase
          .from("payments")
          .select("amount_paid, due_date, status");
        if (period) {
          const { start, end } = getPeriodDates(period);
          q = q.gte("due_date", format(start, "yyyy-MM-dd"))
               .lte("due_date", format(end, "yyyy-MM-dd"));
        }
        return q;
      })();

      // Build period non-installment income query (services / manual entries without payments)
      const periodServiceIncomeQuery = (() => {
        let q = supabase
          .from("transactions")
          .select("amount_received, date")
          .eq("type", "receita")
          .eq("is_auto_generated", false);
        if (period) {
          const { start, end } = getPeriodDates(period);
          q = q.gte("date", format(start, "yyyy-MM-dd"))
               .lte("date", format(end, "yyyy-MM-dd"));
        }
        return q;
      })();

      // Fetch all data in parallel
      const [
        clientsResult,
        allTransactionsResult,
        periodTransactionsResult,
        periodPaymentsResult,
        periodServiceIncomeResult,
        allPaymentsResult,
      ] = await Promise.all([
        supabase.from("clients").select("id, status, payment_status, plan_value"),
        supabase.from("transactions").select("type, amount, amount_received, date, payment_method, expense_category, is_auto_generated"),
        period ? (async () => {
          const { start, end } = getPeriodDates(period);
          return supabase
            .from("transactions")
            .select("type, amount, amount_received, payment_method, expense_category, is_auto_generated")
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd"));
        })() : Promise.resolve(null),
        periodPaymentsQuery,
        periodServiceIncomeQuery,
        supabase.from("payments").select("amount_paid, due_date, status"),
      ]);

      const clients = clientsResult.data || [];
      const allTransactions = allTransactionsResult.data || [];
      const periodTransactions = periodTransactionsResult?.data || allTransactions;
      const periodPayments = periodPaymentsResult.data || [];
      const periodServiceIncome = periodServiceIncomeResult.data || [];
      const allPayments = allPaymentsResult.data || [];

      // Client counts
      const totalClients = clients.length;
      const gestantes = clients.filter((c) => c.status === "gestante").length;
      const puerperas = clients.filter((c) => c.status === "lactante").length;
      const outros = clients.filter((c) => c.status === "outro" || c.status === "tentante").length;

      // Total contracted value from clients
      const totalContracted = clients.reduce((sum, c) => sum + Number(c.plan_value || 0), 0);

      // Period-based financial calculations
      const incomeTransactions = periodTransactions.filter((t) => t.type === "receita");
      const expenseTransactions = periodTransactions.filter((t) => t.type === "despesa");

      const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

      // RECEIVED: use payments table for installment income (distributed by due_date)
      // + transactions.amount_received for non-auto-generated (service) income
      const receivedFromPayments = periodPayments
        .filter((p) => p.status === "pago" || p.status === "parcial")
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      const receivedFromServices = periodServiceIncome
        .reduce((sum, t) => sum + Number(t.amount_received || 0), 0);
      const totalReceived = receivedFromPayments + receivedFromServices;

      const totalPending = totalIncome - totalReceived;
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const balance = totalReceived - totalExpenses;

      // Business intelligence
      const clientsWithRevenue = clients.filter((c) => Number(c.plan_value || 0) > 0).length;
      const averageTicket = clientsWithRevenue > 0 ? totalContracted / clientsWithRevenue : 0;

      // Monthly average: group all-time received by month using payments.due_date + service transactions
      const monthlyTotals: Record<string, number> = {};
      // From payments
      allPayments
        .filter((p) => p.status === "pago" || p.status === "parcial")
        .forEach((p) => {
          const month = p.due_date?.substring(0, 7) || "unknown";
          monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(p.amount_paid || 0);
        });
      // From service transactions (non-auto-generated)
      allTransactions
        .filter((t) => t.type === "receita" && t.is_auto_generated === false)
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
        outros,
        incomeByMethod,
        expensesByCategory,
        transactionCount: periodTransactions.length,
      };
    },
  });
}
