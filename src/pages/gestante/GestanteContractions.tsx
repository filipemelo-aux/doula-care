import { useState, useEffect, useCallback } from "react";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Timer, 
  Play, 
  Square, 
  Trash2, 
  Clock, 
  AlertTriangle,
  Loader2,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { toast } from "sonner";
import { differenceInSeconds, differenceInMinutes } from "date-fns";
import { cn, formatBrazilTime } from "@/lib/utils";
import { sendPushNotification } from "@/lib/pushNotifications";

interface Contraction {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export default function GestanteContractions() {
  const { client } = useGestanteAuth();
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [activeContraction, setActiveContraction] = useState<Contraction | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchContractions = useCallback(async () => {
    if (!client?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("contractions")
        .select("*")
        .eq("client_id", client.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setContractions(data || []);
      
      // Check for active contraction
      const active = data?.find(c => !c.ended_at);
      if (active) {
        setActiveContraction(active);
        const elapsed = differenceInSeconds(new Date(), new Date(active.started_at));
        setElapsedSeconds(elapsed);
      }
    } catch (error) {
      console.error("Error fetching contractions:", error);
    } finally {
      setLoading(false);
    }
  }, [client?.id]);

  useEffect(() => {
    fetchContractions();
  }, [fetchContractions]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeContraction) {
      interval = setInterval(() => {
        const elapsed = differenceInSeconds(new Date(), new Date(activeContraction.started_at));
        setElapsedSeconds(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeContraction]);

  const startContraction = async () => {
    if (!client?.id || starting) return;
    
    setStarting(true);
    try {
      const { data, error } = await supabase
        .from("contractions")
        .insert({
          client_id: client.id,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      setActiveContraction(data);
      setElapsedSeconds(0);
      setContractions(prev => [data, ...prev]);
      toast.success("Contração iniciada");

      // Notify admins via push
      sendPushNotification({
        send_to_admins: true,
        title: "⏱️ Nova Contração Registrada",
        message: `${client.full_name} iniciou uma contração.`,
        url: "/admin",
        tag: `contraction-${client.id}`,
      });
    } catch (error) {
      console.error("Error starting contraction:", error);
      toast.error("Erro ao iniciar contração");
    } finally {
      setStarting(false);
    }
  };

  const stopContraction = async () => {
    if (!activeContraction) return;
    
    const endTime = new Date();
    const duration = differenceInSeconds(endTime, new Date(activeContraction.started_at));
    
    try {
      const { error } = await supabase
        .from("contractions")
        .update({
          ended_at: endTime.toISOString(),
          duration_seconds: duration
        })
        .eq("id", activeContraction.id);

      if (error) throw error;
      
      setContractions(prev => 
        prev.map(c => 
          c.id === activeContraction.id 
            ? { ...c, ended_at: endTime.toISOString(), duration_seconds: duration }
            : c
        )
      );
      setActiveContraction(null);
      setElapsedSeconds(0);
      toast.success(`Contração finalizada: ${formatDuration(duration)}`);

      // Notify admins with duration info
      sendPushNotification({
        send_to_admins: true,
        title: "⏱️ Contração Finalizada",
        message: `${client?.full_name}: duração de ${formatDuration(duration)}.`,
        url: "/admin",
        tag: `contraction-${client?.id}`,
      });
    } catch (error) {
      console.error("Error stopping contraction:", error);
      toast.error("Erro ao finalizar contração");
    }
  };

  const deleteContraction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("contractions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setContractions(prev => prev.filter(c => c.id !== id));
      toast.success("Contração removida");
    } catch (error) {
      console.error("Error deleting contraction:", error);
      toast.error("Erro ao remover contração");
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIntervalFromPrevious = (index: number): string | null => {
    if (index >= contractions.length - 1) return null;
    
    const current = contractions[index];
    const previous = contractions[index + 1];
    
    if (!previous.ended_at || !current.started_at) return null;
    
    const intervalMinutes = differenceInMinutes(
      new Date(current.started_at),
      new Date(previous.ended_at)
    );
    
    return `${intervalMinutes} min`;
  };

  const completedContractions = contractions.filter(c => c.ended_at);
  const avgDuration = completedContractions.length > 0
    ? Math.round(completedContractions.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedContractions.length)
    : 0;

  if (loading) {
    return (
      <GestanteLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GestanteLayout>
    );
  }

  return (
    <GestanteLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg">Contrações</h1>
            <p className="text-xs text-muted-foreground">Registre suas contrações</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Timer Card */}
        <Card className={cn(
          "overflow-hidden transition-all",
          activeContraction 
            ? "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/30" 
            : "bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20"
        )}>
          <CardContent className="p-6">
            {/* Timer Display */}
            <div className="text-center py-8">
              <div className={cn(
                "text-6xl font-mono font-bold mb-2",
                activeContraction ? "text-destructive" : "text-primary"
              )}>
                {formatDuration(elapsedSeconds)}
              </div>
              <p className="text-muted-foreground">
                {activeContraction ? "Contração em andamento..." : "Pronta para registrar"}
              </p>
            </div>

            {/* Action Button */}
            <div className="flex justify-center">
              {activeContraction ? (
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-20 w-20 rounded-full shadow-lg"
                  onClick={stopContraction}
                >
                  <Square className="h-8 w-8" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full shadow-lg bg-primary hover:bg-primary/90"
                  onClick={startContraction}
                  disabled={starting}
                >
                  {starting ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {activeContraction 
                ? "Toque para finalizar a contração" 
                : "Toque para iniciar quando sentir a contração"
              }
            </p>
          </CardContent>
        </Card>

        {/* Stats Card */}
        {completedContractions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-primary">{completedContractions.length}</p>
                <p className="text-xs text-muted-foreground">Contrações</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Timer className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold text-accent">{formatDuration(avgDuration)}</p>
                <p className="text-xs text-muted-foreground">Duração média</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alert for close contractions */}
        {completedContractions.length >= 3 && avgDuration >= 45 && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Atenção</p>
                <p className="text-sm text-yellow-700">
                  Suas contrações estão ficando mais longas. Entre em contato com sua Doula.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-muted-foreground">Histórico</h2>
          </div>

          {completedContractions.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-8 text-center">
                <Timer className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma contração registrada ainda
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedContractions.map((contraction, index) => (
                <Card key={contraction.id} className="overflow-hidden">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Timer className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {formatBrazilTime(contraction.started_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Duração: {formatDuration(contraction.duration_seconds || 0)}
                          {getIntervalFromPrevious(index) && (
                            <span className="ml-2">• Intervalo: {getIntervalFromPrevious(index)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteContraction(contraction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </GestanteLayout>
  );
}
