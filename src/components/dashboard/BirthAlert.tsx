import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Baby, CheckCircle, AlertTriangle, Calendar } from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

export function BirthAlert() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .order("pregnancy_weeks", { ascending: false });

      if (error) throw error;
      
      return data
        .map(client => ({
          ...client,
          current_weeks: calculateCurrentPregnancyWeeks(
            client.pregnancy_weeks,
            client.pregnancy_weeks_set_at,
            client.dpp
          ),
          current_days: calculateCurrentPregnancyDays(client.dpp),
          is_post_term: isPostTerm(client.dpp)
        }))
        .filter(client => client.current_weeks !== null && client.current_weeks >= 37)
        .sort((a, b) => {
          if (a.is_post_term && !b.is_post_term) return -1;
          if (!a.is_post_term && b.is_post_term) return 1;
          return (b.current_weeks || 0) - (a.current_weeks || 0);
        });
    },
  });

  const handleRegisterBirth = (client: Client) => {
    setSelectedClient(client);
    setBirthDialogOpen(true);
  };

  const hasNotifications = clients && clients.length > 0;
  const hasPostTerm = clients?.some(c => c.is_post_term);
  const highPriorityCount = clients?.filter(c => c.is_post_term || (c.current_weeks && c.current_weeks >= 39)).length || 0;

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Notificações</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`card-glass overflow-hidden max-w-full ${
        hasPostTerm 
          ? "border-destructive/30" 
          : hasNotifications 
          ? "border-warning/30" 
          : ""
      }`}>
        <CardHeader className="py-3 px-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className={`h-4 w-4 ${hasNotifications ? "text-warning" : "text-muted-foreground"}`} />
                {highPriorityCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <CardTitle className="text-sm font-semibold">Notificações</CardTitle>
            </div>
            {hasNotifications && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {clients?.length || 0}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          {!hasNotifications ? (
            <div className="flex items-center gap-3 px-3 py-4">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                <p className="text-xs text-muted-foreground/70">Tudo em dia!</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {clients?.map((client) => {
                const isHighPriority = client.is_post_term || (client.current_weeks && client.current_weeks >= 39);
                
                return (
                  <div
                    key={client.id}
                    className={`px-2 py-2 transition-colors hover:bg-muted/30 overflow-hidden ${
                      client.is_post_term ? "bg-destructive/5" : ""
                    }`}
                  >
                    {/* Row 1: Icon + Name */}
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        client.is_post_term
                          ? "bg-destructive/15"
                          : isHighPriority
                          ? "bg-warning/15"
                          : "bg-warning/10"
                      }`}>
                        {client.is_post_term ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        ) : (
                          <Baby className={`h-3 w-3 ${isHighPriority ? "text-warning" : "text-warning/80"}`} />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                        {client.full_name}
                      </span>
                    </div>

                    {/* Row 2: Status + DPP + Badge + Nasceu button */}
                    <div className="flex items-center justify-between mt-1 pl-8">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                        <span className="truncate">
                          {client.is_post_term ? "Pós-data" : "Parto próximo"}
                        </span>
                        {client.dpp && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="flex items-center gap-0.5 flex-shrink-0">
                              <Calendar className="h-2.5 w-2.5" />
                              {format(parseISO(client.dpp), "dd/MM")}
                            </span>
                          </>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] px-1 h-4 border-0 flex-shrink-0 ${
                            client.is_post_term
                              ? "bg-destructive/20 text-destructive"
                              : isHighPriority
                              ? "bg-warning/20 text-warning"
                              : "bg-warning/15 text-warning/90"
                          }`}
                        >
                          {client.current_weeks}s{client.current_days > 0 ? `${client.current_days}d` : ""}
                          {client.is_post_term && " Pós"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 px-2 text-[10px] border-dashed border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-solid flex-shrink-0 transition-all"
                        onClick={() => handleRegisterBirth(client as Client)}
                      >
                        <CheckCircle className="h-3 w-3 mr-0.5" />
                        Registrar Nascimento
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BirthRegistrationDialog
        open={birthDialogOpen}
        onOpenChange={setBirthDialogOpen}
        client={selectedClient}
      />
    </>
  );
}
