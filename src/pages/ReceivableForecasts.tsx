import { useNavigate } from "react-router-dom";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceRecords, brl, fmtDate } from "./ServiceRecords";

export default function ReceivableForecasts() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useServiceRecords();
  const forecasts = data.filter((r) => r.status === "forecast");
  const total = forecasts.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="page-header mb-0">
        <h1 className="page-title">Previsões de Recebimento</h1>
        <p className="page-description">Atendimentos ainda não faturados. Gere a fatura para cobrar a cliente.</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 lg:p-6 shadow-card">
        <p className="text-xs text-muted-foreground/70">Total previsto</p>
        <p className="text-3xl font-bold tracking-tight text-primary">{brl(total)}</p>
        <p className="text-xs text-muted-foreground mt-1">{forecasts.length} atendimento(s) a faturar</p>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : forecasts.length === 0 ? (
          <div className="rounded-2xl bg-card shadow-card p-10 text-center">
            <p className="font-medium text-foreground/70">Nada a faturar</p>
            <p className="text-sm text-muted-foreground mt-1">Novos atendimentos aparecem aqui automaticamente.</p>
          </div>
        ) : (
          forecasts.map((r) => (
            <div key={r.id} className="rounded-2xl bg-card shadow-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.service_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.clients?.full_name || "Sem cliente"} · {fmtDate(r.service_date)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold">{brl(r.amount)}</span>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    navigate("/financeiro", {
                      state: {
                        invoiceFromRecord: {
                          id: r.id,
                          client_id: r.client_id,
                          amount: r.amount,
                          description: r.service_name,
                          date: r.service_date,
                          notes: r.notes,
                        },
                      },
                    })
                  }
                >
                  <Receipt className="w-4 h-4" /> Gerar fatura
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
