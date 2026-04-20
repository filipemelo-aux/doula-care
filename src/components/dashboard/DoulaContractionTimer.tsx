import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Square, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";

interface DoulaContractionTimerProps {
  clientId: string;
  organizationId: string | null;
  compact?: boolean;
}

export function DoulaContractionTimer({ clientId, organizationId, compact }: DoulaContractionTimerProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Restore an ongoing contraction if one exists (e.g. opened by Doula previously)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("contractions")
        .select("id, started_at")
        .eq("client_id", clientId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setActiveId(data.id);
      setStartedAt(new Date(data.started_at).getTime());
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    intervalRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["client-contractions", clientId] });
    queryClient.invalidateQueries({ queryKey: ["recent-contractions"] });
    queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("contractions")
        .insert({
          client_id: clientId,
          organization_id: organizationId,
          started_at: nowIso,
          read_by_admin: true,
        })
        .select("id, started_at")
        .single();
      if (error) throw error;
      setActiveId(data.id);
      setStartedAt(new Date(data.started_at).getTime());
      invalidate();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao iniciar contração");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeId || startedAt === null) return;
    setLoading(true);
    try {
      const endedAt = new Date();
      const duration = Math.max(1, Math.floor((endedAt.getTime() - startedAt) / 1000));
      const { error } = await supabase
        .from("contractions")
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: duration,
        })
        .eq("id", activeId);
      if (error) throw error;
      setActiveId(null);
      setStartedAt(null);
      setElapsed(0);
      invalidate();
      toast.success(`Contração registrada (${formatTime(duration)})`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao finalizar");
    } finally {
      setLoading(false);
    }
  };

  const isActive = activeId !== null;

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60 border border-destructive/30">
        <Timer className={`h-3 w-3 ${isActive ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
        <span className={`text-[11px] font-mono font-semibold tabular-nums ${isActive ? "text-destructive" : "text-muted-foreground"}`}>
          {formatTime(elapsed)}
        </span>
      </div>
      {isActive ? (
        <Button
          size="sm"
          onClick={handleStop}
          disabled={loading}
          className="h-6 px-2 text-[10px] bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Square className="h-2.5 w-2.5 mr-1 fill-current" />Parar</>}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleStart}
          disabled={loading}
          className="h-6 px-2 text-[10px] bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Play className="h-2.5 w-2.5 mr-1 fill-current" />Cronometrar</>}
        </Button>
      )}
    </div>
  );
}
