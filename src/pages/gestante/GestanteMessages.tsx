import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  MessageCircle, 
  Loader2,
  CheckCircle,
  Clock,
  Sparkles,
  Check,
  X,
  Trash2,
  Send,
  Paperclip,
  Camera,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatBrazilDateTime } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sendPushNotification } from "@/lib/pushNotifications";
import { uploadMessageAttachment, compressImageIfNeeded } from "@/lib/uploadAttachment";

type Notification = Tables<"client_notifications">;

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  budget_value: number | null;
  budget_sent_at: string | null;
  created_at: string;
  scheduled_date: string | null;
  preferred_date: string | null;
}

export default function GestanteMessages() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { client, organizationId } = useGestanteAuth();
  const queryClient = useQueryClient();

  // Fetch regular notifications
  useEffect(() => {
    if (client?.id) {
      fetchNotifications();
    }
  }, [client?.id]);

  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase
      .channel("gestante-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_notifications", filter: `client_id=eq.${client.id}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client?.id]);

  const fetchNotifications = async () => {
    if (!client?.id) return;
    try {
      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (client?.id && notifications.length > 0) {
      const unreadByClient = notifications.filter(n => !(n as any).read_by_client);
      if (unreadByClient.length > 0) {
        markAllAsReadByClient(unreadByClient.map(n => n.id));
      }
    }
  }, [client?.id, notifications]);

  const markAllAsReadByClient = async (ids: string[]) => {
    try {
      await supabase
        .from("client_notifications")
        .update({ read_by_client: true })
        .in("id", ids);
      queryClient.invalidateQueries({ queryKey: ["admin-all-messages"] });
    } catch (error) {
      console.error("Error marking as read by client:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notifications.length]);

  const { data: pendingBudgets } = useQuery({
    queryKey: ["my-pending-budgets", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("client_id", client.id)
        .eq("status", "budget_sent")
        .order("budget_sent_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!client?.id,
    refetchInterval: 30000,
  });

  const acceptBudgetMutation = useMutation({
    mutationFn: async (request: ServiceRequest) => {
      if (!client?.id) throw new Error("Cliente não encontrado");
      const { data, error } = await supabase.functions.invoke("respond-budget", {
        body: { request_id: request.id, action: "accept" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      sendPushNotification({
        send_to_admins: true,
        title: `✅ Orçamento Aceito: ${request.service_type}`,
        message: `${client.full_name} aceitou o orçamento.`,
        url: "/admin",
        tag: "budget-accepted",
      });
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-budgets"] });
      toast.success("Orçamento aceito!", {
        description: `O serviço de ${request.service_type} foi adicionado aos seus pagamentos.`,
      });
    },
    onError: () => {
      toast.error("Erro ao aceitar orçamento", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  const rejectBudgetMutation = useMutation({
    mutationFn: async (request: ServiceRequest) => {
      if (!client?.id) throw new Error("Cliente não encontrado");
      const { data, error } = await supabase.functions.invoke("respond-budget", {
        body: { request_id: request.id, action: "reject" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      sendPushNotification({
        send_to_admins: true,
        title: `❌ Orçamento Recusado: ${request.service_type}`,
        message: `${client.full_name} recusou o orçamento.`,
        url: "/admin",
        tag: "budget-rejected",
      });
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-budgets"] });
      toast.info("Orçamento recusado", {
        description: `Você recusou o serviço de ${request.service_type}.`,
      });
    },
    onError: () => {
      toast.error("Erro ao recusar orçamento", {
        description: "Tente novamente em alguns instantes.",
      });
    },
  });

  const clearAllNotifications = async () => {
    if (!client?.id) return;
    try {
      const ids = regularNotifications.map(n => n.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("client_notifications")
        .delete()
        .in("id", ids);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => isBudgetNotification(n)));
      toast.success("Mensagens limpas!");
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast.error("Erro ao limpar mensagens");
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB");
      return;
    }
    const compressed = await compressImageIfNeeded(file);
    setSelectedFile(compressed);
    if (compressed.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(compressed));
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
  };

  const handleSendMessage = async () => {
    if (!client?.id || (!newMessage.trim() && !selectedFile)) return;
    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;

      if (selectedFile) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || "anonymous";
        const result = await uploadMessageAttachment(selectedFile, userId);
        attachmentUrl = result.url;
        attachmentType = result.type;
      }

      const messageText = newMessage.trim() || (attachmentType === "image" ? "📷 Foto" : "📎 Arquivo");

      const { error } = await supabase
        .from("client_notifications")
        .insert({
          client_id: client.id,
          title: `Mensagem de ${client.full_name}`,
          message: messageText,
          read: false,
          read_by_client: true,
          organization_id: organizationId || null,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
        });
      if (error) throw error;

      sendPushNotification({
        send_to_admins: true,
        title: `💬 Nova mensagem: ${client.full_name}`,
        message: messageText.substring(0, 100),
        url: "/admin",
        tag: "client-message",
      });

      setNewMessage("");
      clearSelectedFile();
      fetchNotifications();
      toast.success("Mensagem enviada!");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error?.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = notifications.filter(n => !(n as any).read_by_client).length + (pendingBudgets?.length || 0);

  const isBudgetNotification = (notification: Notification) => {
    return notification.title.startsWith("Orçamento:");
  };

  const isClientMessage = (notification: Notification) => {
    return notification.title.startsWith("Mensagem de ");
  };

  const regularNotifications = notifications.filter(n => !isBudgetNotification(n));

  const renderAttachment = (notification: any, isMine: boolean) => {
    if (!notification.attachment_url) return null;
    if (notification.attachment_type === "image") {
      return (
        <a href={notification.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={notification.attachment_url}
            alt="Anexo"
            className="rounded-lg max-w-[200px] max-h-[200px] object-cover border"
            loading="lazy"
          />
        </a>
      );
    }
    return (
      <a
        href={notification.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 mt-1 text-xs underline ${isMine ? "text-primary-foreground/80" : "text-primary"}`}
      >
        <FileText className="h-3.5 w-3.5" />
        Ver arquivo
      </a>
    );
  };

  return (
    <GestanteLayout>
      <div className="p-3 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="page-header mb-0">
            <h1 className="page-title">Mensagens</h1>
            <p className="page-description">Comunicados da sua Doula</p>
          </div>
          <div className="flex items-center gap-2">
            {regularNotifications.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar mensagens?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as mensagens serão removidas permanentemente. Orçamentos pendentes não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllNotifications}>
                      Limpar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} nova{unreadCount > 1 ? "s" : ""}</Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : regularNotifications.length === 0 && (!pendingBudgets || pendingBudgets.length === 0) ? (
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-dashed">
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-primary/40 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhuma mensagem</h3>
              <p className="text-muted-foreground text-sm">
                Envie mensagens e comprovantes para sua Doula usando o campo abaixo
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-18rem)]">
            <div className="space-y-3 flex flex-col">
              {regularNotifications.map((notification) => {
                const isMine = isClientMessage(notification);
                return (
                  <div
                    key={notification.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <Card
                      className={`max-w-[85%] transition-all ${
                        isMine
                          ? "bg-primary text-primary-foreground border-primary"
                          : (notification as any).read_by_client
                            ? "bg-background"
                            : "bg-primary/5 border-primary/20 shadow-sm"
                      }`}
                    >
                      <CardContent className="p-3">
                        {!isMine && (
                          <div className="flex items-center gap-2 mb-1">
                            {(notification as any).read_by_client ? (
                              <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-primary" />
                            )}
                            <p className="font-medium text-sm">{notification.title}</p>
                          </div>
                        )}
                        <p className={`text-sm ${isMine ? "text-primary-foreground" : "text-muted-foreground"} ${!isMine ? "mt-1" : ""}`}>
                          {notification.message}
                        </p>
                        {renderAttachment(notification, isMine)}
                        <p className={`text-[10px] mt-2 ${isMine ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                          {formatBrazilDateTime(notification.created_at, "dd/MM 'às' HH:mm")}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}

              {pendingBudgets?.map((budget) => (
                <div key={`budget-${budget.id}`} className="flex justify-start">
                  <Card className="max-w-[85%] bg-secondary border-primary/20 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <Badge className="bg-primary text-primary-foreground text-[10px]">
                          Orçamento
                        </Badge>
                      </div>
                      <p className="font-medium text-sm text-foreground">{budget.service_type}</p>
                      <p className="text-xl font-bold text-accent my-2">
                        R$ {(budget.budget_value || 0).toFixed(2).replace(".", ",")}
                      </p>
                      {/* Show date info */}
                      {budget.scheduled_date && (
                        <p className="text-xs text-primary font-medium mb-1">
                          📅 Data: {formatBrazilDateTime(budget.scheduled_date, "dd/MM/yyyy 'às' HH:mm")}
                          {budget.preferred_date && budget.scheduled_date !== budget.preferred_date && (
                            <span className="text-orange-600 ml-1">(diferente da sua preferência)</span>
                          )}
                        </p>
                      )}
                      {!budget.scheduled_date && budget.preferred_date && (
                        <p className="text-xs text-muted-foreground mb-1">
                          📅 Data solicitada: {formatBrazilDateTime(budget.preferred_date, "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mb-3">
                        Sua Doula enviou este orçamento. Deseja aprovar?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => acceptBudgetMutation.mutate(budget)}
                          disabled={acceptBudgetMutation.isPending || rejectBudgetMutation.isPending}
                        >
                          {acceptBudgetMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Aceitar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
                          onClick={() => rejectBudgetMutation.mutate(budget)}
                          disabled={acceptBudgetMutation.isPending || rejectBudgetMutation.isPending}
                        >
                          {rejectBudgetMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Recusar
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {budget.budget_sent_at && formatBrazilDateTime(budget.budget_sent_at, "dd/MM 'às' HH:mm")}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* File preview */}
        {selectedFile && (
          <div className="sticky bottom-14 left-0 right-0 z-30 bg-muted/80 backdrop-blur-sm border-t p-2">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate flex-1">{selectedFile.name}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearSelectedFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Compose message area */}
        <div className="sticky bottom-0 left-0 right-0 z-30 bg-background border-t p-3 mt-auto">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
            />

            {/* Attach buttons */}
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => cameraInputRef.current?.click()}
                title="Tirar foto"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={sending || (!newMessage.trim() && !selectedFile)}
              className="h-11 w-11 shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </GestanteLayout>
  );
}
