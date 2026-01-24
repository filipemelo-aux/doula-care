import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Baby, CheckCircle } from "lucide-react";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { BirthRegistrationDialog } from "@/components/clients/BirthRegistrationDialog";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const formatClientName = (fullName: string, isMobile: boolean) => {
  if (!isMobile) return fullName;
  const maxLength = 20;
  if (fullName.length <= maxLength) return fullName;
  return `${fullName.slice(0, maxLength)}...`;
};

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
      
      // Calculate current weeks and filter those >= 37
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
          // Sort by post-term first, then by weeks
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

  if (isLoading) {
    return (
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Parto se Aproximando
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!clients || clients.length === 0) {
    return null;
  }

  // Check if any client is post-term
  const hasPostTerm = clients.some(c => c.is_post_term);

  return (
    <>
      <Card className={`border-2 transition-colors ${
        hasPostTerm 
          ? "border-red-300 bg-red-50/70 dark:border-red-800 dark:bg-red-950/30" 
          : "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-base font-semibold flex items-center gap-2 ${
            hasPostTerm 
              ? "text-red-700 dark:text-red-400" 
              : "text-orange-700 dark:text-orange-400"
          }`}>
            <AlertTriangle className="h-4 w-4" />
            {hasPostTerm ? "Atenção: Gestação Pós-Data" : "Parto se Aproximando"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`p-2 rounded-lg ${
                  client.is_post_term 
                    ? "bg-red-100/80 dark:bg-red-900/30" 
                    : "bg-white/60 dark:bg-background/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    client.is_post_term 
                      ? "bg-red-200 dark:bg-red-800/50" 
                      : "bg-orange-100 dark:bg-orange-900/30"
                  }`}>
                    <Baby className={`h-4 w-4 ${
                      client.is_post_term 
                        ? "text-red-600 dark:text-red-400" 
                        : "text-orange-600 dark:text-orange-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate lg:whitespace-normal">
                      {formatClientName(client.full_name, isMobile)}
                    </p>
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 lg:gap-3 mt-2">
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] lg:text-xs px-1.5 lg:px-2.5 h-5 lg:h-6 border-0 ${
                      client.is_post_term
                        ? "bg-red-200 text-red-800 dark:bg-red-800/50 dark:text-red-300"
                        : (client.current_weeks || 0) >= 40 
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}
                  >
                    {client.current_weeks}s{client.current_days > 0 ? `${client.current_days}d` : ""}
                    {client.is_post_term && " - Pós-Data"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 lg:h-8 px-2 lg:px-3 text-xs lg:text-sm hover:bg-primary/10"
                    onClick={() => handleRegisterBirth(client as Client)}
                  >
                    <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                    Nasceu
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
