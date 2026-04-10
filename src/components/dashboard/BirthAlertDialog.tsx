import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Baby, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { formatBrazilDate } from "@/lib/utils";
import { fetchBirthAlertClients } from "@/lib/birthAlerts";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface BirthAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BirthAlertDialog({ open, onOpenChange }: BirthAlertDialogProps) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Baby className="h-5 w-5 text-warning" />
              Alertas de Parto
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {isLoading ? (
              <div className="space-y-3 py-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : !clients || clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Baby className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma gestante em alerta</p>
                <p className="text-xs text-muted-foreground/60">
                  Trabalho de parto, contração em andamento e gestantes com 37+ semanas aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 py-1">
                {clients.map((client) => {
                  const isHighPriority =
                    client.is_in_labor || client.is_post_term || (client.current_weeks !== null && client.current_weeks >= 39);
                  const statusLabel = client.labor_started_at
                    ? "Trabalho de parto"
                    : client.has_ongoing_contraction
                    ? "Contração em andamento"
                    : client.is_post_term
                    ? "Pós-data"
                    : "Parto próximo";
                  const weeksLabel =
                    client.current_weeks !== null
                      ? `${client.current_weeks}s${client.current_days > 0 ? `${client.current_days}d` : ""}${client.is_post_term ? " Pós" : ""}`
                      : null;
                  const laborBadgeLabel =
                    client.labor_started_at || client.recent_contractions_10m >= 3
                      ? "🚨 EM TRABALHO DE PARTO"
                      : "⚠️ CONTRAÇÃO EM ANDAMENTO";

                  return (
                    <div
                      key={client.id}
                      className={`py-3 px-1 transition-colors ${client.is_in_labor ? "bg-destructive/5" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            client.is_in_labor
                              ? "bg-destructive/20"
                              : client.is_post_term
                              ? "bg-destructive/15"
                              : isHighPriority
                              ? "bg-warning/15"
                              : "bg-warning/10"
                          }`}
                        >
                          {client.is_in_labor ? (
                            <Baby className="h-4 w-4 text-destructive animate-bounce" />
                          ) : client.is_post_term ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Baby className={`h-4 w-4 ${isHighPriority ? "text-warning" : "text-warning/80"}`} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{client.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
                            {client.dpp && (
                              <>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {formatBrazilDate(client.dpp, "dd/MM")}
                                </span>
                              </>
                            )}
                            {weeksLabel && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 h-4 border-0 ${
                                  client.is_in_labor
                                    ? "bg-destructive/20 text-destructive"
                                    : client.is_post_term
                                    ? "bg-destructive/20 text-destructive"
                                    : isHighPriority
                                    ? "bg-warning/20 text-warning"
                                    : "bg-warning/15 text-warning/90"
                                }`}
                              >
                                {weeksLabel}
                              </Badge>
                            )}
                          </div>

                          {client.is_in_labor && (
                            <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 h-4 animate-pulse mt-1">
                              {laborBadgeLabel}
                            </Badge>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] border-dashed text-primary hover:bg-primary hover:text-primary-foreground hover:border-solid flex-shrink-0"
                          onClick={() => handleRegisterBirth(client as Client)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Nascimento
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
