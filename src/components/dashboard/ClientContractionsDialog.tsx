import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Timer, Clock, Calendar, Loader2, TrendingDown } from "lucide-react";
import { differenceInMinutes, differenceInSeconds } from "date-fns";
import { formatBrazilDate, formatBrazilTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

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
    </Dialog>
  );
}
