import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, CreditCard, Banknote } from "lucide-react";
import { PeriodOption, getPeriodLabel } from "./PeriodFilter";
import { useFinancialMetrics, formatCurrency } from "@/hooks/useFinancialMetrics";

interface FinancialOverviewProps {
  period: PeriodOption;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

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

export function FinancialOverview({ period }: FinancialOverviewProps) {
  const { data: metrics, isLoading } = useFinancialMetrics(period);

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Visão Financeira - {getPeriodLabel(period)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Visão Financeira - {getPeriodLabel(period)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-success/5 border border-success/10">
            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-2xl font-semibold text-success">
                {formatCurrency(metrics?.totalIncome || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Recebido: {formatCurrency(metrics?.totalReceived || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-warning/5 border border-warning/10">
            <div className="w-12 h-12 rounded-xl bg-warning/15 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-2xl font-semibold text-warning">
                {formatCurrency(metrics?.totalPending || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-2xl font-semibold text-destructive">
                {formatCurrency(metrics?.totalExpenses || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-2xl font-semibold ${(metrics?.balance || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(metrics?.balance || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Income by Payment Method */}
        {metrics?.incomeByMethod && Object.keys(metrics.incomeByMethod).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              Receitas por Forma de Pagamento
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(metrics.incomeByMethod).map(([method, value]) => (
                <div key={method} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {paymentMethodLabels[method] || method}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses by Category */}
        {metrics?.expensesByCategory && Object.keys(metrics.expensesByCategory).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Banknote className="w-4 h-4" />
              Top Categorias de Despesa
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.expensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([category, value]) => (
                  <div key={category} className="px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <span className="text-xs text-muted-foreground">
                      {categoryLabels[category] || category}
                    </span>
                    <p className="text-sm font-medium text-destructive">
                      {formatCurrency(value)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
