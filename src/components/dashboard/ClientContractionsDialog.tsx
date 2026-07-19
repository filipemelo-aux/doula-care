import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Timer, Calendar, Loader2, TrendingDown, Baby, XCircle } from "lucide-react";
import { differenceInMinutes, differenceInSeconds } from "date-fns";
import { formatBrazilDate, formatBrazilTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { DoulaContractionTimer } from "@/components/dashboard/DoulaContractionTimer";
import { toast } from "sonner";

type Client = Tables<"clients">;
type Contraction = Tables<"contractions">;

interface ClientContractionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function ClientContractionsDialog({
  open,
  onOpenChange,
  client,
}: ClientContractionsDialogProps) {
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [laborCancelled, setLaborCancelled] = useState(false);

  // Reset local cancelled flag when opening for a different client / re-opening
  useEffect(() => {
    if (open) setLaborCancelled(false);
  }, [open, client?.id]);

  const { data: contractions, isLoading } = useQuery({
    queryKey: ["client-contractions", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      
      const { data, error } = await supabase
        .from("contractions")
        .select("*")
        .eq("client_id", client.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Contraction[];
    },
    enabled: open && !!client?.id,
  });

  const handleCancelLabor = async () => {
    if (!client?.id) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ labor_started_at: null, labor_started_by: null } as any)
        .eq("id", client.id);
      if (error) throw error;
      setLaborCancelled(true);
      toast.success("Trabalho de parto cancelado.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-clients"] }),
        queryClient.invalidateQueries({ queryKey: ["client-contractions", client.id] }),
        queryClient.invalidateQueries({ queryKey: ["client-quick-view", client.id] }),
      ]);
      setCancelOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível cancelar. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  };

  // Mark unread contractions as read when dialog opens
  useEffect(() => {
    const markAsRead = async () => {
      if (!open || !client?.id || !contractions) return;
      
      const unreadIds = contractions
        .filter(c => !(c as any).read_by_admin)
        .map(c => c.id);
      
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("contractions")
        .update({ read_by_admin: true } as any)
        .in("id", unreadIds);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
        queryClient.invalidateQueries({ queryKey: ["client-contractions", client.id] });
      }
    };

    const timeout = setTimeout(markAsRead, 500);
    return () => clearTimeout(timeout);
  }, [open, client?.id, contractions, queryClient]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const calculateInterval = (current: Contraction, previous: Contraction | undefined) => {
    if (!previous) return null;
    const diffMins = differenceInMinutes(
      new Date(current.started_at),
      new Date(previous.started_at)
    );
    const diffSecs = differenceInSeconds(
      new Date(current.started_at),
      new Date(previous.started_at)
    ) % 60;
    
    if (diffMins < 1) return `${diffSecs}s`;
    return diffSecs > 0 ? `${diffMins}m ${diffSecs}s` : `${diffMins}m`;
  };

  const getIntervalColor = (current: Contraction, previous: Contraction | undefined) => {
    if (!previous) return "text-muted-foreground";
    const diffMins = differenceInMinutes(
      new Date(current.started_at),
      new Date(previous.started_at)
    );
    if (diffMins < 2) return "text-destructive";
    if (diffMins < 5) return "text-orange-500";
    return "text-muted-foreground";
  };

  const groupByDate = (items: Contraction[]) => {
    const grouped: Record<string, Contraction[]> = {};
    items.forEach(item => {
      const dateKey = formatBrazilDate(item.started_at, "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });
    return grouped;
  };

  const groupedContractions = contractions ? groupByDate(contractions) : {};

  // Calculate stats
  const stats = contractions && contractions.length > 0 ? {
    total: contractions.length,
    avgDuration: Math.round(
      contractions.reduce((acc, c) => acc + (c.duration_seconds || 0), 0) / contractions.length
    ),
    avgInterval: contractions.length > 1 ? Math.round(
      contractions.slice(0, -1).reduce((acc, c, i) => {
        const next = contractions[i + 1];
        return acc + differenceInMinutes(new Date(c.started_at), new Date(next.started_at));
      }, 0) / (contractions.length - 1)
    ) : null
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Timer className="h-5 w-5 text-orange-500" />
            Histórico de Contrações
          </DialogTitle>
          <DialogDescription className="truncate">
            {client?.full_name}
          </DialogDescription>
        </DialogHeader>

        {client?.labor_started_at && !laborCancelled && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
              <Baby className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-destructive">Trabalho de parto ativo</p>
              <p className="text-[11px] text-muted-foreground">
                Iniciado em {formatBrazilDate(client.labor_started_at, "dd/MM 'às' HH:mm")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={cancelling}
              className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setCancelOpen(true)}
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1" />
              )}
              {cancelling ? "Cancelando..." : "Cancelar"}
            </Button>
          </div>
        )}

        {/* Doula Live Timer - available when there is active labor context or existing contraction history */}
        {client?.id && ((client.labor_started_at && !laborCancelled) || (contractions?.length ?? 0) > 0) && (
          <div className="mb-3">
            <DoulaContractionTimer
              clientId={client.id}
              organizationId={client.organization_id}
            />
          </div>
        )}

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">{formatDuration(stats.avgDuration)}</p>
              <p className="text-[10px] text-muted-foreground">Duração média</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">{stats.avgInterval ? `${stats.avgInterval}m` : "—"}</p>
              <p className="text-[10px] text-muted-foreground">Intervalo médio</p>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[50vh] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : contractions && contractions.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedContractions).map(([dateKey, dayContractions]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatBrazilDate(dateKey, "EEEE, dd/MM")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                      {dayContractions.length} contrações
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    {dayContractions.map((contraction, idx) => {
                      const previousContraction = dayContractions[idx + 1];
                      const interval = calculateInterval(contraction, previousContraction);
                      const intervalColor = getIntervalColor(contraction, previousContraction);
                      
                      return (
                        <Card key={contraction.id} className="overflow-hidden">
                          <CardContent className="p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                  <Timer className="h-3 w-3 text-orange-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium">
                                    {formatBrazilTime(contraction.started_at, "HH:mm:ss")}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Duração: {formatDuration(contraction.duration_seconds)}
                                  </p>
                                </div>
                              </div>
                              
                              {interval && (
                                <div className={`flex items-center gap-1 text-[10px] ${intervalColor}`}>
                                  <TrendingDown className="h-3 w-3" />
                                  <span>{interval}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma contração registrada</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar trabalho de parto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover o marcador de trabalho de parto desta cliente. Use esta opção quando a gestante marcou por engano ou o quadro não se confirmou. O histórico de contrações será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                handleCancelLabor();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
