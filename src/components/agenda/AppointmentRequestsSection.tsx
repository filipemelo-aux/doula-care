import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarCheck,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  MessageSquare,
  CalendarPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotifications";

interface AppointmentRequestWithClient {
  id: string;
  client_id: string;
  requested_date: string;
  requested_time: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  clients: { full_name: string; user_id: string | null };
}

export function AppointmentRequestsSection() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [respondDialog, setRespondDialog] = useState<{
    request: AppointmentRequestWithClient;
    action: "approve" | "reject";
  } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-appointment-requests", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select("*, clients(full_name, user_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AppointmentRequestWithClient[];
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      request,
      action,
      notes,
    }: {
      request: AppointmentRequestWithClient;
      action: "approve" | "reject";
      notes: string;
    }) => {
      const newStatus = action === "approve" ? "approved" : "rejected";

      // Update request status
      const { error: updateError } = await supabase
        .from("appointment_requests")
        .update({
          status: newStatus,
          admin_notes: notes || null,
        })
        .eq("id", request.id);
      if (updateError) throw updateError;

      if (action === "approve") {
        // Create actual appointment
        const scheduledAt = new Date(
          `${request.requested_date}T${request.requested_time}`
        );
        const { error: aptError } = await supabase
          .from("appointments")
          .insert({
            client_id: request.client_id,
            title: "Consulta (solicitada)",
            scheduled_at: scheduledAt.toISOString(),
            notes: request.reason
              ? `Motivo: ${request.reason}${notes ? `\nNota: ${notes}` : ""}`
              : notes || null,
            owner_id: user?.id || null,
            organization_id: organizationId || null,
          });
        if (aptError) throw aptError;
      }

      // Notify client
      const clientName = request.clients?.full_name || "Cliente";
      const dateStr = format(
        new Date(request.requested_date + "T00:00:00"),
        "dd/MM/yyyy"
      );
      const timeStr = request.requested_time.slice(0, 5);

      await supabase.from("client_notifications").insert({
        client_id: request.client_id,
        title:
          action === "approve"
            ? "✅ Consulta Confirmada"
            : "❌ Consulta não aprovada",
        message:
          action === "approve"
            ? `Sua consulta do dia ${dateStr} às ${timeStr} foi confirmada!${notes ? ` Nota: ${notes}` : ""}`
            : `Sua solicitação de consulta para ${dateStr} às ${timeStr} não foi aprovada.${notes ? ` Motivo: ${notes}` : ""}`,
        organization_id: organizationId || null,
      });

      // Push notification to client
      if (request.clients?.user_id) {
        sendPushNotification({
          user_ids: [request.clients.user_id],
          title:
            action === "approve"
              ? "✅ Consulta Confirmada"
              : "❌ Consulta não aprovada",
          message:
            action === "approve"
              ? `Sua consulta do dia ${dateStr} às ${timeStr} foi confirmada!`
              : `Sua solicitação para ${dateStr} às ${timeStr} não foi aprovada.`,
          type: "appointment_reminder",
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-appointment-requests"],
      });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      setRespondDialog(null);
      setAdminNotes("");
      toast.success(
        variables.action === "approve"
          ? "Consulta aprovada e agendada!"
          : "Solicitação recusada."
      );
    },
    onError: () => toast.error("Erro ao processar solicitação"),
  });

  const pendingRequests = (requests || []).filter(
    (r) => r.status === "pending"
  );
  const processedRequests = (requests || []).filter(
    (r) => r.status !== "pending"
  );

  if (isLoading) return null;
  if (!requests || requests.length === 0) return null;

  return (
    <>
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            Solicitações de Consulta
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0"
            >
              {pendingRequests.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {pendingRequests.map((req) => {
              const dateStr = format(
                new Date(req.requested_date + "T00:00:00"),
                "dd/MM/yyyy"
              );
              const dayStr = format(
                new Date(req.requested_date + "T00:00:00"),
                "EEEE",
                { locale: ptBR }
              );
              return (
                <Card
                  key={req.id}
                  className="border-primary/30 bg-primary/5"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="text-center min-w-[44px]">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(
                            new Date(req.requested_date + "T00:00:00"),
                            "MMM",
                            { locale: ptBR }
                          )}
                        </p>
                        <p className="text-lg font-bold leading-tight">
                          {format(
                            new Date(req.requested_date + "T00:00:00"),
                            "dd"
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-sm">
                          {req.clients?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dayStr}, {req.requested_time.slice(0, 5)}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {req.reason}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Solicitado em{" "}
                          {format(new Date(req.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Aprovar"
                          onClick={() =>
                            setRespondDialog({
                              request: req,
                              action: "approve",
                            })
                          }
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Recusar"
                          onClick={() =>
                            setRespondDialog({
                              request: req,
                              action: "reject",
                            })
                          }
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Processed Requests (last 5) */}
      {processedRequests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" /> Solicitações Processadas
          </h2>
          <div className="space-y-2">
            {processedRequests.slice(0, 5).map((req) => {
              const isApproved = req.status === "approved";
              return (
                <Card key={req.id} className="opacity-70">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[44px]">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(
                            new Date(req.requested_date + "T00:00:00"),
                            "MMM",
                            { locale: ptBR }
                          )}
                        </p>
                        <p className="text-lg font-bold leading-tight">
                          {format(
                            new Date(req.requested_date + "T00:00:00"),
                            "dd"
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {req.clients?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.requested_time.slice(0, 5)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${isApproved ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}
                      >
                        {isApproved ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {isApproved ? "Aprovada" : "Recusada"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Respond Dialog */}
      <Dialog
        open={!!respondDialog}
        onOpenChange={(o) => {
          if (!o) {
            setRespondDialog(null);
            setAdminNotes("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {respondDialog?.action === "approve" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Aprovar Consulta
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Recusar Consulta
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {respondDialog && (
                <>
                  <strong>{respondDialog.request.clients?.full_name}</strong> —{" "}
                  {format(
                    new Date(
                      respondDialog.request.requested_date + "T00:00:00"
                    ),
                    "dd/MM/yyyy"
                  )}{" "}
                  às {respondDialog.request.requested_time.slice(0, 5)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">
                {respondDialog?.action === "approve"
                  ? "Observações (opcional)"
                  : "Motivo da recusa (opcional)"}
              </Label>
              <Textarea
                placeholder={
                  respondDialog?.action === "approve"
                    ? "Ex: Confirmo a consulta. Nos vemos lá!"
                    : "Ex: Infelizmente não tenho disponibilidade neste horário."
                }
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRespondDialog(null);
                setAdminNotes("");
              }}
              disabled={respondMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant={
                respondDialog?.action === "approve" ? "default" : "destructive"
              }
              onClick={() => {
                if (respondDialog) {
                  respondMutation.mutate({
                    request: respondDialog.request,
                    action: respondDialog.action,
                    notes: adminNotes,
                  });
                }
              }}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {respondDialog?.action === "approve"
                ? "Aprovar e Agendar"
                : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
