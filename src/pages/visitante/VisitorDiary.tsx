import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  BookHeart,
  Plus,
  Loader2,
  Calendar,
  Smile,
  Frown,
  Meh,
  Heart,
  Sparkles,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatBrazilDate, formatBrazilTime, cn } from "@/lib/utils";
import { DiaryEntryDialog } from "@/components/gestante/DiaryEntryDialog";

interface DiaryEntry {
  id: string;
  content: string;
  emotion: string | null;
  symptoms: string[] | null;
  observations: string | null;
  created_at: string;
}

const emotionIcons: Record<string, { icon: typeof Smile; color: string; label: string }> = {
  feliz: { icon: Smile, color: "text-green-500", label: "Feliz" },
  triste: { icon: Frown, color: "text-blue-500", label: "Triste" },
  ansiosa: { icon: AlertCircle, color: "text-yellow-500", label: "Ansiosa" },
  calma: { icon: Heart, color: "text-primary", label: "Calma" },
  animada: { icon: Sparkles, color: "text-purple-500", label: "Animada" },
  cansada: { icon: Meh, color: "text-gray-500", label: "Cansada" },
};

export default function VisitorDiary() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setClientId(data?.id || null);
    })();
  }, [user]);

  useEffect(() => {
    if (clientId) fetchEntries();
  }, [clientId]);

  const fetchEntries = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from("pregnancy_diary")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar diário");
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      const { error } = await supabase.from("pregnancy_diary").delete().eq("id", deleteEntryId);
      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== deleteEntryId));
      toast.success("Registro excluído!");
    } catch (e) {
      toast.error("Erro ao excluir registro");
    } finally {
      setDeleteEntryId(null);
    }
  };

  const getEmotionDisplay = (emotion: string | null) => {
    if (!emotion) return null;
    const data = emotionIcons[emotion];
    if (!data) return null;
    const Icon = data.icon;
    return (
      <div className={`flex items-center gap-1 ${data.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm">{data.label}</span>
      </div>
    );
  };

  const grouped: Record<string, DiaryEntry[]> = {};
  entries.forEach((e) => {
    const k = formatBrazilDate(e.created_at, "yyyy-MM-dd");
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  });

  return (
    <VisitorLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="page-header mb-0">
            <h1 className="page-title">Diário da Gestação</h1>
            <p className="page-description">Seus momentos e sentimentos</p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card className={cn("border-dashed bg-gradient-to-br from-primary/5 to-accent/5")}>
            <CardContent className="py-12 text-center">
              <BookHeart className="h-12 w-12 mx-auto mb-4 text-primary/40" />
              <h3 className="font-semibold text-lg mb-2">Seu diário está vazio</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Comece a registrar seus momentos especiais durante a gestação
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro registro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateKey, dayEntries]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatBrazilDate(dateKey, "EEEE, dd 'de' MMMM")}
                  </span>
                </div>
                <div className="space-y-3">
                  {dayEntries.map((entry) => (
                    <Card key={entry.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <span className="text-xs text-muted-foreground">
                            {formatBrazilTime(entry.created_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            {getEmotionDisplay(entry.emotion)}
                            <button
                              onClick={() => setDeleteEntryId(entry.id)}
                              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mb-3">{entry.content}</p>
                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {entry.symptoms.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {entry.observations && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground italic">{entry.observations}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteEntryId} onOpenChange={(o) => !o && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Este registro será removido permanentemente do seu diário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEntry}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {clientId && (
        <DiaryEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          clientId={clientId}
          onSuccess={fetchEntries}
          isPuerpera={false}
        />
      )}
    </VisitorLayout>
  );
}
