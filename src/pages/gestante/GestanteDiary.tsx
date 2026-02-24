import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trash2
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

export default function GestanteDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const { client } = useGestanteAuth();
  
  const isPuerpera = client?.status === "lactante" && client?.birth_occurred;

  useEffect(() => {
    if (client?.id) {
      fetchEntries();
    }
  }, [client?.id]);

  const fetchEntries = async () => {
    if (!client?.id) return;
    try {
      const { data, error } = await supabase
        .from("pregnancy_diary")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching diary entries:", error);
      toast.error("Erro ao carregar diário");
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      const { error } = await supabase
        .from("pregnancy_diary")
        .delete()
        .eq("id", deleteEntryId);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== deleteEntryId));
      toast.success("Registro excluído!");
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Erro ao excluir registro");
    } finally {
      setDeleteEntryId(null);
    }
  };

  const getEmotionDisplay = (emotion: string | null) => {
    if (!emotion) return null;
    const emotionData = emotionIcons[emotion];
    if (!emotionData) return null;
    const Icon = emotionData.icon;
    return (
      <div className={`flex items-center gap-1 ${emotionData.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm">{emotionData.label}</span>
      </div>
    );
  };

  const groupEntriesByDate = (entries: DiaryEntry[]) => {
    const grouped: Record<string, DiaryEntry[]> = {};
    entries.forEach(entry => {
      const dateKey = formatBrazilDate(entry.created_at, "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });
    return grouped;
  };

  const groupedEntries = groupEntriesByDate(entries);

  return (
    <GestanteLayout>
      <div className="p-3 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="page-header mb-0">
            <h1 className="page-title">
              {isPuerpera ? "Diário do Puerpério" : "Diário da Gestação"}
            </h1>
            <p className="page-description">
              {isPuerpera ? "Sua jornada como mamãe" : "Seus momentos e sentimentos"}
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

      
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card className={cn(
            "border-dashed",
            isPuerpera 
              ? "bg-gradient-to-br from-primary/5 to-accent/5" 
              : "bg-gradient-to-br from-primary/5 to-accent/5"
          )}>
            <CardContent className="py-12 text-center">
              <BookHeart className={cn(
                "h-12 w-12 mx-auto mb-4",
                isPuerpera ? "text-primary/60" : "text-primary/40"
              )} />
              <h3 className="font-semibold text-lg mb-2">Seu diário está vazio</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {isPuerpera 
                  ? "Comece a registrar seus momentos especiais como mamãe"
                  : "Comece a registrar seus momentos especiais durante a gestação"
                }
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro registro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([dateKey, dayEntries]) => (
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
                          
                          <p className="text-sm whitespace-pre-wrap mb-3">
                            {entry.content}
                          </p>
                          
                          {entry.symptoms && entry.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {entry.symptoms.map((symptom, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {symptom}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {entry.observations && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground italic">
                                {entry.observations}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Delete confirmation */}
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

      <DiaryEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={client?.id || ""}
        onSuccess={fetchEntries}
        isPuerpera={isPuerpera}
      />
    </GestanteLayout>
  );
}
