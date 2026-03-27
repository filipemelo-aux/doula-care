import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Receipt, X, Gift } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function BillingAlertBanner() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["org-notifications", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("org_notifications")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("read", false)
        .in("type", ["billing", "promotion"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("org_notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-notifications", organizationId] });
    },
  });

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((notif) => {
        const isPromo = notif.type === "promotion";
        return (
        <Alert key={notif.id} variant="destructive" className={`pr-16 ${isPromo
53:           ? "border-none border-30 bg-gradient-to-r from-primary/5 to-accent/5 text-foreground"
54:           : "bg-amber-50/80 dark:bg-amber-950/20 text-foreground"
55:         }`}>
          {isPromo ? <Gift className="h-4 w-4 text-primary" /> : <Receipt className="h-4 w-4 text-amber-600" />}
          <AlertTitle className={`${isPromo ? "text-primary" : "text-amber-700 dark:text-amber-400"} text-sm font-semibold`}>
            {notif.title}
          </AlertTitle>
          <AlertDescription className={`${isPromo ? "text-muted-foreground" : "text-amber-600 dark:text-amber-300"} text-xs`}>
            {notif.message}
            <span className="block text-[10px] text-muted-foreground mt-1">
              {format(new Date(notif.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={() => dismissMutation.mutate(notif.id)}
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Alert>
        );
      })}
    </div>
  );
}
