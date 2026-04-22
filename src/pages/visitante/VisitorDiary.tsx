import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VisitorLayout } from "@/components/visitante/VisitorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  getGuestDiary,
  setGuestDiary,
  type GuestDiaryEntry,
} from "@/lib/guestVisitor";

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
  const isGuest = !user;
  const [clientId, setClientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestText, setGuestText] = useState("");
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) {
      setEntries(getGuestDiary());
      setLoading(false);
      return;
    }
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setClientId(data?.id || null);
    })();
  }, [user, isGuest]);

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
      if (isGuest) {
        const updated = entries.filter((e) => e.id !== deleteEntryId);
        setEntries(updated);
        setGuestDiary(updated as GuestDiaryEntry[]);
        toast.success("Registro excluído!");
        return;
      }
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

  const handleNewEntry = () => {
    if (isGuest) {
      setGuestText("");
      setGuestDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const saveGuestEntry = () => {
    if (!guestText.trim()) {
      toast.error("Escreva algo antes de salvar");
      return;
    }
    const entry: GuestDiaryEntry = {
      id: `local-${Date.now()}`,
      content: guestText.trim(),
      emotion: null,
      symptoms: null,
      observations: null,
      created_at: new Date().toISOString(),
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    setGuestDiary(updated as GuestDiaryEntry[]);
    setGuestDialogOpen(false);
    setGuestText("");
    toast.success("Registro salvo no seu diário 💗");
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
            <p className="page-description">
              {isGuest ? "Registros locais no seu dispositivo" : "Seus momentos e sentimentos"}
            </p>
          </div>
          <Button size="sm" onClick={handleNewEntry}>
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
              <Button onClick={handleNewEntry}>
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

      {/* Authenticated diary dialog */}
      {!isGuest && clientId && (
        <DiaryEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          clientId={clientId}
          onSuccess={fetchEntries}
          isPuerpera={false}
        />
      )}

      {/* Guest simple diary dialog */}
      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo registro</DialogTitle>
            <DialogDescription className="text-xs">
              Seu registro fica salvo apenas neste dispositivo. Crie sua conta para sincronizar e
              compartilhar com sua doula.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Como você se sente hoje?</Label>
            <Textarea
              value={guestText}
              onChange={(e) => setGuestText(e.target.value)}
              placeholder="Conte seus momentos, sentimentos e emoções..."
              className="min-h-[140px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGuestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveGuestEntry}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VisitorLayout>
  );
}
