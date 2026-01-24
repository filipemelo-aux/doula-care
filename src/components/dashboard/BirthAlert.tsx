import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Baby } from "lucide-react";

const formatClientName = (fullName: string, maxLength = 20) => {
  if (fullName.length <= maxLength) return fullName;
  return `${fullName.slice(0, maxLength)}...`;
};

export function BirthAlert() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, pregnancy_weeks, phone")
        .eq("status", "gestante")
        .gte("pregnancy_weeks", 37)
        .order("pregnancy_weeks", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

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

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Parto se Aproximando
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-white/60 dark:bg-background/40"
            >
              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <Baby className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {formatClientName(client.full_name)}
                </p>
                <p className="text-xs text-muted-foreground">{client.phone}</p>
              </div>
              <Badge 
                variant="outline" 
                className={`flex-shrink-0 text-[10px] px-1.5 h-5 border-0 ${
                  client.pregnancy_weeks >= 40 
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                }`}
              >
                {client.pregnancy_weeks} sem
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
