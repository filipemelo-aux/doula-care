import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Receipt, X } from "lucide-react";
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
        .eq("type", "billing")
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
      {notifications.map((notif) => (
        <Alert key={notif.id} variant="destructive" className="border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/20 text-foreground">
          <Receipt className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
            {notif.title}
          </AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-300 text-xs">
            {notif.message}
            <span className="block text-[10px] text-muted-foreground mt-1">
              {format(new Date(notif.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0"
            onClick={() => dismissMutation.mutate(notif.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
