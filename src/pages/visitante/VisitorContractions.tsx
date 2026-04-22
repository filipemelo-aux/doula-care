import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Play, Square, Trash2, Clock, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { differenceInSeconds, differenceInMinutes } from "date-fns";
import { cn, formatBrazilTime } from "@/lib/utils";
import {
  getGuestContractions,
  setGuestContractions,
  type GuestContraction,
} from "@/lib/guestVisitor";

interface Contraction {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export default function VisitorContractions() {
  const { user } = useAuth();
  const isGuest = !user;
  const [clientId, setClientId] = useState<string | null>(null);
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [active, setActive] = useState<Contraction | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Resolve client id (only when authenticated)
  useEffect(() => {
    if (!user) {
      setClientId(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
      setClientId(data?.id || null);
    })();
  }, [user]);

  const fetchContractions = useCallback(async () => {
    if (isGuest) {
      const list = getGuestContractions();
      setContractions(list);
      const a = list.find((c) => !c.ended_at) || null;
      if (a) {
        setActive(a);
        setElapsed(differenceInSeconds(new Date(), new Date(a.started_at)));
      }
      setLoading(false);
      return;
    }
    if (!clientId) return;
    const { data } = await supabase
      .from("contractions")
      .select("*")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(50);
    setContractions(data || []);
    const a = data?.find((c) => !c.ended_at);
    if (a) {
      setActive(a);
      setElapsed(differenceInSeconds(new Date(), new Date(a.started_at)));
    }
    setLoading(false);
  }, [clientId, isGuest]);

  useEffect(() => {
    fetchContractions();
  }, [fetchContractions]);

  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => {
      setElapsed(differenceInSeconds(new Date(), new Date(active.started_at)));
    }, 1000);
    return () => clearInterval(i);
  }, [active]);

  const persistGuest = (list: Contraction[]) => {
    setGuestContractions(list as GuestContraction[]);
  };

  const start = async () => {
    if (starting) return;

    if (isGuest) {
      const newC: Contraction = {
        id: `local-${Date.now()}`,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      };
      const updated = [newC, ...contractions];
      setContractions(updated);
      persistGuest(updated);
      setActive(newC);
      setElapsed(0);
      toast.success("Contração iniciada");
      return;
    }

    if (!clientId) return;
    setStarting(true);
    const { data, error } = await supabase
      .from("contractions")
      .insert({ client_id: clientId, started_at: new Date().toISOString() })
      .select()
      .single();
    setStarting(false);
    if (error) {
      toast.error("Erro ao iniciar contração");
      return;
    }
    setActive(data);
    setElapsed(0);
    setContractions((prev) => [data, ...prev]);
    toast.success("Contração iniciada");
  };

  const stop = async () => {
    if (!active) return;
    const end = new Date();
    const dur = differenceInSeconds(end, new Date(active.started_at));

    if (isGuest) {
      const updated = contractions.map((c) =>
        c.id === active.id ? { ...c, ended_at: end.toISOString(), duration_seconds: dur } : c
      );
      setContractions(updated);
      persistGuest(updated);
      setActive(null);
      setElapsed(0);
      toast.success(`Contração finalizada: ${fmt(dur)}`);
      return;
    }

    const { error } = await supabase
      .from("contractions")
      .update({ ended_at: end.toISOString(), duration_seconds: dur })
      .eq("id", active.id);
    if (error) {
      toast.error("Erro ao finalizar");
      return;
    }
    setContractions((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, ended_at: end.toISOString(), duration_seconds: dur } : c))
    );
    setActive(null);
    setElapsed(0);
    toast.success(`Contração finalizada: ${fmt(dur)}`);
  };

  const remove = async (id: string) => {
    if (isGuest) {
      const updated = contractions.filter((c) => c.id !== id);
      setContractions(updated);
      persistGuest(updated);
      return;
    }
    await supabase.from("contractions").delete().eq("id", id);
    setContractions((prev) => prev.filter((c) => c.id !== id));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const completed = contractions.filter((c) => c.ended_at);
  const avg = completed.length
    ? Math.round(completed.reduce((a, c) => a + (c.duration_seconds || 0), 0) / completed.length)
    : 0;

  const interval = (i: number) => {
    if (i >= contractions.length - 1) return null;
    const cur = contractions[i];
    const prev = contractions[i + 1];
    if (!prev.ended_at || !cur.started_at) return null;
    return `${differenceInMinutes(new Date(cur.started_at), new Date(prev.ended_at))} min`;
  };

  if (loading) {
    return (
      <VisitorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout>
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Contrações</h1>
          <p className="page-description">
            {isGuest
              ? "Registre suas contrações — os dados ficam no seu dispositivo"
              : "Registre e cronometre suas contrações"}
          </p>
        </div>

        <Card
          className={cn(
            "overflow-hidden transition-all",
            active ? "bg-gradient-to-br from-destructive/10 to-destructive/5" : "bg-gradient-to-br from-primary/10 to-accent/10"
          )}
        >
          <CardContent className="p-6">
            <div className="text-center py-8">
              <div className={cn("text-6xl font-mono font-bold mb-2", active ? "text-destructive" : "text-primary")}>
                {fmt(elapsed)}
              </div>
              <p className="text-muted-foreground">
                {active ? "Contração em andamento..." : "Pronta para registrar"}
              </p>
            </div>
            <div className="flex justify-center">
              {active ? (
                <Button size="lg" variant="destructive" className="h-20 w-20 rounded-full shadow-lg" onClick={stop}>
                  <Square className="h-8 w-8" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full shadow-lg bg-primary hover:bg-primary/90"
                  onClick={start}
                  disabled={starting}
                >
                  {starting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Play className="h-8 w-8 ml-1" />}
                </Button>
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              {active ? "Toque para finalizar a contração" : "Toque para iniciar quando sentir a contração"}
            </p>
          </CardContent>
        </Card>

        {completed.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-primary">{completed.length}</p>
                <p className="text-xs text-muted-foreground">Contrações</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Timer className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold text-accent">{fmt(avg)}</p>
                <p className="text-xs text-muted-foreground">Duração média</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-muted-foreground">Histórico</h2>
          </div>
          {completed.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-8 text-center">
                <Timer className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma contração registrada ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completed.map((c, i) => (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Timer className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{formatBrazilTime(c.started_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          Duração: {fmt(c.duration_seconds || 0)}
                          {interval(i) && <span className="ml-2">• Intervalo: {interval(i)}</span>}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(c.id)}
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
    </VisitorLayout>
  );
}
