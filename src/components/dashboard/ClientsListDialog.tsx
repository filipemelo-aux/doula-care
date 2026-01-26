import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Baby, 
  Heart, 
  Calendar, 
  Scale, 
  Ruler, 
  Clock, 
  MessageCircle,
  BookHeart
} from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { abbreviateName } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { SendNotificationDialog } from "@/components/clients/SendNotificationDialog";
import { ClientDiaryDialog } from "./ClientDiaryDialog";

type Client = Tables<"clients">;
type ClientStatus = "gestante" | "lactante";

interface ClientsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ClientStatus;
}

export function ClientsListDialog({
  open,
  onOpenChange,
  status,
}: ClientsListDialogProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients-list-dialog", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", status)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: open,
  });

  const title = status === "gestante" ? "Gestantes em Acompanhamento" : "Lactantes Pós-Parto";
  const description = status === "gestante" 
    ? "Lista de todas as gestantes atualmente em acompanhamento" 
    : "Lista de todas as mães em período pós-parto";
  const Icon = status === "gestante" ? Baby : Heart;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : clients && clients.length > 0 ? (
            <div className="space-y-3">
              {clients.map((client) => {
                const currentWeeks = status === "gestante" 
                  ? calculateCurrentPregnancyWeeks(client.pregnancy_weeks, client.pregnancy_weeks_set_at, client.dpp)
                  : null;
                const currentDays = status === "gestante" && client.dpp
                  ? calculateCurrentPregnancyDays(client.dpp)
                  : 0;
                const postTerm = status === "gestante" ? isPostTerm(client.dpp) : false;
                const babyNames = client.baby_names as string[] | null;

                return (
                  <div
                    key={client.id}
                    className={`p-4 rounded-lg border ${
                      postTerm 
                        ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" 
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm truncate">
                            {isMobile ? abbreviateName(client.full_name) : client.full_name}
                          </h4>
                          {/* Badge after name on both mobile and desktop */}
                          {status === "gestante" && currentWeeks !== null && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] h-5 ${
                                postTerm
                                  ? "bg-red-200 text-red-800 border-red-300 dark:bg-red-800/50 dark:text-red-300"
                                  : currentWeeks >= 40
                                    ? "bg-orange-100 text-orange-700 border-orange-200"
                                    : "bg-primary/10 text-primary border-primary/20"
                              }`}
                            >
                              {currentWeeks}s{currentDays > 0 ? `${currentDays}d` : ""}
                              {postTerm && " - Pós-Data"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
                        
                        {babyNames && babyNames.length > 0 && (
                          <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                            <Baby className="h-3 w-3" />
                            {babyNames.join(", ")}
                          </p>
                        )}
                      </div>

                      {/* Action buttons for gestantes - desktop only inline */}
                      {status === "gestante" && !isMobile && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
                              setDiaryDialogOpen(true);
                            }}
                            title="Ver diário"
                          >
                            <BookHeart className="h-4 w-4 text-pink-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
                              setNotificationDialogOpen(true);
                            }}
                            title="Enviar mensagem"
                          >
                            <MessageCircle className="h-4 w-4 text-primary" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons for gestantes - mobile only (new row) */}
                    {status === "gestante" && isMobile && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                            setDiaryDialogOpen(true);
                          }}
                        >
                          <BookHeart className="h-3.5 w-3.5 mr-1.5 text-pink-500" />
                          Diário
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                            setNotificationDialogOpen(true);
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          Mensagem
                        </Button>
                      </div>
                    )}

                    {/* Gestante Info */}
                    {status === "gestante" && client.dpp && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            DPP: {formatDate(client.dpp)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Lactante/Birth Info */}
                    {status === "lactante" && client.birth_occurred && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {client.birth_date && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3 w-3 text-primary" />
                              <span>{formatDate(client.birth_date)}</span>
                              {client.birth_time && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(client.birth_time)}
                                </span>
                              )}
                            </div>
                          )}
                          {client.birth_weight && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Scale className="h-3 w-3 text-primary" />
                              <span>{Number(client.birth_weight).toFixed(3)} kg</span>
                            </div>
                          )}
                          {client.birth_height && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Ruler className="h-3 w-3 text-primary" />
                              <span>{Number(client.birth_height).toFixed(2)} cm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma {status === "gestante" ? "gestante" : "lactante"} encontrada</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      {/* Notification Dialog */}
      <SendNotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
        client={selectedClient}
      />

      {/* Diary Dialog */}
      <ClientDiaryDialog
        open={diaryDialogOpen}
        onOpenChange={setDiaryDialogOpen}
        client={selectedClient}
      />
    </Dialog>
  );
}