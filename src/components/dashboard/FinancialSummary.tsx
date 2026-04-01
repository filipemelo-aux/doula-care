import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FinancialSummary() {
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: financials, isLoading } = useQuery({
    queryKey: ["monthly-transactions", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("type, amount, amount_received")
        .gte("date", startStr)
        .lte("date", endStr);

      if (error) throw error;

      const incomeTransactions = transactions?.filter((t) => t.type === "receita") || [];
      const expenseTransactions = transactions?.filter((t) => t.type === "despesa") || [];

      // Same logic as Financial.tsx: received = sum(amount_received) from income transactions
      const income = incomeTransactions.reduce((sum, t) => sum + Number(t.amount_received || 0), 0);
      const expenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

      return { income, expenses, balance: income - expenses };
    },
  });

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Resumo do Mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const income = financials?.income || 0;
  const expenses = financials?.expenses || 0;
  const balance = financials?.balance || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Resumo de {format(currentMonth, "MMMM", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-lg bg-success/5">
          <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Receitas</p>
            <p className="text-xl font-semibold text-success">{formatCurrency(income)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/5">
          <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Despesas</p>
            <p className="text-xl font-semibold text-destructive">{formatCurrency(expenses)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className={`text-xl font-semibold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
