import { KeyboardEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Baby, AlertTriangle, CheckCircle, Calendar, Activity, Clock } from "lucide-react";
import { formatBrazilDate } from "@/lib/utils";
import { fetchBirthAlertClients, type BirthAlertClient } from "@/lib/birthAlerts";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface BirthAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenContractions: (client: Client) => void;
}

export function BirthAlertDialog({ open, onOpenChange, onOpenContractions }: BirthAlertDialogProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: fetchBirthAlertClients,
    enabled: open,
  });

  const handleRegisterBirth = (client: Client) => {
    setSelectedClient(client);
    setBirthDialogOpen(true);
  };

  const handleOpenContractions = (client: BirthAlertClient) => {
    onOpenContractions(client as Client);
  };

  const laborClients = clients?.filter((c) => c.is_in_labor) ?? [];
  const watchClients = clients?.filter((c) => !c.is_in_labor) ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[420px] max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0 rounded-[18px]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Baby className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Alertas de Parto</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {clients?.length
                  ? `${laborClients.length > 0 ? `${laborClients.length} em trabalho de parto • ` : ""}${clients.length} gestante${clients.length > 1 ? "s" : ""} em acompanhamento`
                  : "Nenhum alerta no momento"}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : !clients || clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-16 h-16 rounded-[20px] bg-muted/30 flex items-center justify-center">
                  <Baby className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tudo tranquilo</p>
                  <p className="text-xs text-muted-foreground/50 mt-1 max-w-[220px] mx-auto">
                    Gestantes com 37+ semanas ou em trabalho de parto aparecerão aqui
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {laborClients.length > 0 && (
                  <div className="space-y-2">
                    {laborClients.map((client) => (
                      <AlertCard
                        key={client.id}
                        client={client}
                        onRegisterBirth={handleRegisterBirth}
                        onOpenContractions={handleOpenContractions}
                      />
                    ))}
                  </div>
                )}

                {watchClients.length > 0 && (
                  <>
                    {laborClients.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 pb-1">
                        <div className="h-px flex-1 bg-border/50" />
                        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Em observação</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {watchClients.map((client) => (
                        <AlertCard
                          key={client.id}
                          client={client}
                          onRegisterBirth={handleRegisterBirth}
                          onOpenContractions={handleOpenContractions}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BirthRegistrationDialog
        open={birthDialogOpen}
        onOpenChange={setBirthDialogOpen}
        client={selectedClient}
      />
    </>
  );
}

function AlertCard({
  client,
  onRegisterBirth,
  onOpenContractions,
}: {
  client: BirthAlertClient;
  onRegisterBirth: (c: Client) => void;
  onOpenContractions: (c: BirthAlertClient) => void;
}) {
  const isLabor = client.is_in_labor;
  const isHighPriority = isLabor || client.is_post_term || (client.current_weeks !== null && client.current_weeks >= 39);

  const weeksLabel =
    client.current_weeks !== null
      ? `${client.current_weeks}s${client.current_days > 0 ? `${client.current_days}d` : ""}`
      : null;

  const statusConfig = isLabor
    ? {
        label: client.labor_started_at ? "Em trabalho de parto" : client.has_ongoing_contraction ? "Contração em andamento" : "Contrações frequentes",
        badge: client.labor_started_at || client.recent_contractions_10m >= 3 ? "TRABALHO DE PARTO" : "CONTRAÇÃO ATIVA",
        cardBg: "bg-destructive/[0.04]",
        iconBg: "bg-destructive/15",
        iconColor: "text-destructive",
        weeksBg: "bg-destructive/10 text-destructive",
      }
    : client.is_post_term
      ? {
          label: "Gestação pós-data",
          badge: null,
          cardBg: "bg-warning/[0.04]",
          iconBg: "bg-warning/15",
          iconColor: "text-warning",
          weeksBg: "bg-destructive/10 text-destructive",
        }
      : {
          label: "Parto se aproximando",
          badge: null,
          cardBg: "hover:bg-muted/30",
          iconBg: isHighPriority ? "bg-warning/12" : "bg-primary/8",
          iconColor: isHighPriority ? "text-warning" : "text-primary/70",
          weeksBg: isHighPriority ? "bg-warning/10 text-warning" : "bg-primary/8 text-primary/70",
        };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenContractions(client);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenContractions(client)}
      onKeyDown={handleKeyDown}
      className={cn(
        "rounded-2xl p-3 transition-all duration-200",
        statusConfig.cardBg,
        "cursor-pointer",
        isLabor ? "ring-1 ring-destructive/15 hover:bg-destructive/[0.07]" : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
            statusConfig.iconBg
          )}
        >
          {isLabor ? (
            <Activity className={cn("h-4 w-4", statusConfig.iconColor, "animate-pulse")} />
          ) : client.is_post_term ? (
            <AlertTriangle className={cn("h-4 w-4", statusConfig.iconColor)} />
          ) : (
            <Baby className={cn("h-4 w-4", statusConfig.iconColor)} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground truncate">{client.full_name}</p>
            {weeksLabel && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 h-[18px] border-0 font-semibold flex-shrink-0 rounded-md",
                  statusConfig.weeksBg
                )}
              >
                {weeksLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-muted-foreground">{statusConfig.label}</span>
            {client.dpp && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
                  <Calendar className="h-2.5 w-2.5" />
                  DPP {formatBrazilDate(client.dpp, "dd/MM")}
                </span>
              </>
            )}
          </div>

          {isLabor && statusConfig.badge && (
            <div className="mt-1.5">
              <Badge className="bg-destructive/90 text-destructive-foreground text-[9px] px-2 h-[18px] font-bold tracking-wide animate-pulse rounded-md">
                <Activity className="h-2.5 w-2.5 mr-1" />
                {statusConfig.badge}
              </Badge>
            </div>
          )}

          {client.recent_contractions_10m > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/70">
                {client.recent_contractions_10m} contração(ões) nos últimos 10min
              </span>
            </div>
          )}
        </div>

        {/* Action icons column */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 ml-1">
          <button
            type="button"
            aria-label="Ver histórico de contrações"
            onClick={(event) => {
              event.stopPropagation();
              onOpenContractions(client);
            }}
            className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all active:scale-95"
          >
            <Activity className={cn("h-4 w-4", isLabor && "animate-pulse")} />
          </button>
          <button
            type="button"
            aria-label="Registrar nascimento"
            onClick={(event) => {
              event.stopPropagation();
              onRegisterBirth(client as Client);
            }}
            className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 flex items-center justify-center transition-all active:scale-95"
          >
            <Baby className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
