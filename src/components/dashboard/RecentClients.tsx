import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookHeart, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientDiaryDialog } from "@/components/dashboard/ClientDiaryDialog";
import { SendNotificationDialog } from "@/components/clients/SendNotificationDialog";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Puérpera",
};

const planLabels = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
};

const paymentStatusLabels = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

export function RecentClients() {
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [diaryClient, setDiaryClient] = useState<Tables<"clients"> | null>(null);
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [notifClient, setNotifClient] = useState<Tables<"clients"> | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["recent-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("dpp", { ascending: true, nullsFirst: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Clientes Recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Clientes Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {clients && clients.length > 0 ? (
          <div className="space-y-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex flex-col gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {client.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                    {client.dpp && (
                      <p className="text-xs text-muted-foreground">DPP: {format(parseISO(client.dpp), "dd/MM/yyyy")}</p>
                    )}
                  </div>
                  <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title={`Enviar notificação para ${client.full_name}`}
                      onClick={() => {
                        setNotifClient(client);
                        setNotifDialogOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  {(client.status === "gestante" || client.status === "lactante") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-primary hover:bg-primary/10"
                      title={client.status === "lactante" ? "Diário do Puerpério" : "Diário da Gestação"}
                      onClick={() => {
                        setDiaryClient(client);
                        setDiaryDialogOpen(true);
                      }}
                    >
                      <BookHeart className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap pl-14">
                  <Badge
                    variant="outline"
                    className={cn("badge-status border-0 text-[10px] px-1.5 h-5", `badge-${client.status}`)}
                  >
                    {statusLabels[client.status as keyof typeof statusLabels]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5">
                    {planLabels[client.plan as keyof typeof planLabels]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("badge-status border-0 text-[10px] px-1.5 h-5", `badge-${client.payment_status}`)}
                  >
                    {paymentStatusLabels[client.payment_status as keyof typeof paymentStatusLabels]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Nenhum cliente cadastrado ainda
          </p>
        )}
      </CardContent>
    </Card>

    <ClientDiaryDialog
      open={diaryDialogOpen}
      onOpenChange={setDiaryDialogOpen}
      client={diaryClient}
    />

    <SendNotificationDialog
      open={notifDialogOpen}
      onOpenChange={setNotifDialogOpen}
      client={notifClient}
    />
    </>
  );
}
