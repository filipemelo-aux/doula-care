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
import { 
  BookHeart, 
  Smile, 
  Frown, 
  Meh, 
  Heart, 
  Sparkles, 
  AlertCircle,
  Calendar,
  Loader2,
  Eye
} from "lucide-react";
import { formatBrazilDate, formatBrazilTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type DiaryEntry = Tables<"pregnancy_diary"> & { read_by_admin?: boolean };

interface ClientDiaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const emotionIcons: Record<string, { icon: typeof Smile; color: string; label: string }> = {
  feliz: { icon: Smile, color: "text-green-500", label: "Feliz" },
  triste: { icon: Frown, color: "text-blue-500", label: "Triste" },
  ansiosa: { icon: AlertCircle, color: "text-yellow-500", label: "Ansiosa" },
  calma: { icon: Heart, color: "text-pink-500", label: "Calma" },
  animada: { icon: Sparkles, color: "text-purple-500", label: "Animada" },
  cansada: { icon: Meh, color: "text-gray-500", label: "Cansada" },
};

export function ClientDiaryDialog({
  open,
  onOpenChange,
  client,
}: ClientDiaryDialogProps) {
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["client-diary", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      
      const { data, error } = await supabase
        .from("pregnancy_diary")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as DiaryEntry[];
    },
    enabled: open && !!client?.id,
  });

  // Mark unread entries as read when dialog opens
  useEffect(() => {
    const markAsRead = async () => {
      if (!open || !client?.id || !entries) return;
      
      const unreadEntryIds = entries
        .filter(entry => !entry.read_by_admin)
        .map(entry => entry.id);
      
      if (unreadEntryIds.length === 0) return;

      const { error } = await supabase
        .from("pregnancy_diary")
        .update({ read_by_admin: true })
        .in("id", unreadEntryIds);

      if (!error) {
        // Invalidate queries to refresh notification indicators
        queryClient.invalidateQueries({ queryKey: ["recent-diary-entries"] });
        queryClient.invalidateQueries({ queryKey: ["recent-diary-entries-by-client"] });
        queryClient.invalidateQueries({ queryKey: ["client-diary", client.id] });
      }
    };

    // Small delay to ensure entries are loaded
    const timeout = setTimeout(markAsRead, 500);
    return () => clearTimeout(timeout);
  }, [open, client?.id, entries, queryClient]);

  const getEmotionDisplay = (emotion: string | null) => {
    if (!emotion) return null;
    const emotionData = emotionIcons[emotion];
    if (!emotionData) return null;
    
    const Icon = emotionData.icon;
    return (
      <div className={`flex items-center gap-1 ${emotionData.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-xs">{emotionData.label}</span>
      </div>
    );
  };

  const groupEntriesByDate = (entries: DiaryEntry[]) => {
    const grouped: Record<string, DiaryEntry[]> = {};
    
    entries.forEach(entry => {
      const dateKey = formatBrazilDate(entry.created_at, "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });
    
    return grouped;
  };

  const groupedEntries = entries ? groupEntriesByDate(entries) : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <BookHeart className="h-5 w-5 text-primary" />
            Diário da Gestação
          </DialogTitle>
          <DialogDescription>
            Registros de {client?.full_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedEntries).map(([dateKey, dayEntries]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatBrazilDate(dateKey, "EEEE, dd 'de' MMMM")}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <Card 
                        key={entry.id} 
                        className={`overflow-hidden ${!entry.read_by_admin ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatBrazilTime(entry.created_at)}
                              </span>
                              {!entry.read_by_admin && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/30">
                                  <Eye className="h-2.5 w-2.5 mr-0.5" />
                                  Novo
                                </Badge>
                              )}
                            </div>
                            {getEmotionDisplay(entry.emotion)}
                          </div>
                          
                          <p className="text-sm whitespace-pre-wrap mb-2">
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
                            <div className="mt-2 pt-2 border-t">
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookHeart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum registro encontrado</p>
              <p className="text-xs mt-1">A gestante ainda não fez registros no diário</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
