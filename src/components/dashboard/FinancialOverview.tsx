import { Skeleton } from "@/components/ui/skeleton";
import { PeriodOption, getPeriodLabel } from "./PeriodFilter";
import { useFinancialMetrics, formatCurrency } from "@/hooks/useFinancialMetrics";
import { CreditCard, Banknote } from "lucide-react";

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
      <div className="rounded-2xl bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4 lg:p-6 shadow-card space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const totalContracted = metrics?.totalContracted || 0;
  const totalReceived = metrics?.totalReceived || 0;
  const totalPending = metrics?.totalPending || 0;
  const averageTicket = metrics?.averageTicket || 0;
  const totalExpenses = metrics?.totalExpenses || 0;
  const balance = metrics?.balance || 0;

  return (
    <div className="space-y-4">
      {/* Hero stats — same aesthetic as Financial page */}
      <div className="rounded-2xl bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4 lg:p-6 shadow-card">
        <p className="text-xs text-muted-foreground/70 mb-0.5">
          Receita Contratada — {getPeriodLabel(period)}
        </p>
        <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          {formatCurrency(totalContracted)}
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Recebido</p>
            <p className="text-sm lg:text-base font-semibold text-success">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">A receber</p>
            <p className="text-sm lg:text-base font-semibold text-amber-600/80">{formatCurrency(totalPending)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Ticket Médio</p>
            <p className="text-sm lg:text-base font-semibold text-primary">{formatCurrency(averageTicket)}</p>
          </div>
        </div>
      </div>

      {/* Income by Payment Method */}
      {metrics?.incomeByMethod && Object.keys(metrics.incomeByMethod).length > 0 && (
        <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            Receitas por Forma de Pagamento
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(metrics.incomeByMethod).map(([method, value]) => (
              <div key={method} className="space-y-0.5">
                <p className="text-[10px] lg:text-xs text-muted-foreground/60">
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
        <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Banknote className="w-4 h-4" />
            Top Categorias de Despesa
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(metrics.expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([category, value]) => (
                <div key={category} className="space-y-0.5">
                  <p className="text-[10px] lg:text-xs text-muted-foreground/60">
                    {categoryLabels[category] || category}
                  </p>
                  <p className="text-sm font-medium text-destructive">
                    {formatCurrency(value)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
