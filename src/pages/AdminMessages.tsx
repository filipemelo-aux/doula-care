import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  Loader2,
  Send,
  Search,
  ArrowLeft,
  User,
  CheckCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatBrazilDateTime, abbreviateName } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { sendPushNotification } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

type Client = Tables<"clients">;
type Notification = Tables<"client_notifications">;

export default function AdminMessages() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all clients
  const { data: clients } = useQuery({
    queryKey: ["admin-message-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch all messages (client_notifications)
  const { data: allMessages, isLoading } = useQuery({
    queryKey: ["admin-all-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 10000,
  });

  // Filter only message-type notifications (from client or admin messages)
  const isMessage = (n: Notification) => {
    return (
      n.title.startsWith("Mensagem de ") ||
      n.title === "Mensagem da Doula" ||
      n.title.startsWith("💬") ||
      // Admin-sent messages that aren't system notifications
      (!n.title.startsWith("Orçamento:") &&
        !n.title.includes("bebê está a caminho") &&
        !n.title.includes("trabalho de parto") &&
        !n.title.includes("Lembrete") &&
        !n.title.includes("Pagamento"))
    );
  };

  // Group messages by client
  const messagesByClient = new Map<string, Notification[]>();
  allMessages?.forEach((msg) => {
    if (!messagesByClient.has(msg.client_id)) {
      messagesByClient.set(msg.client_id, []);
    }
    messagesByClient.get(msg.client_id)!.push(msg);
  });

  // Get clients with conversations, sorted by last message
  const clientsWithMessages = clients
    ?.filter((c) => messagesByClient.has(c.id))
    ?.sort((a, b) => {
      const aMessages = messagesByClient.get(a.id) || [];
      const bMessages = messagesByClient.get(b.id) || [];
      const aLatest = aMessages[0]?.created_at || "";
      const bLatest = bMessages[0]?.created_at || "";
      return bLatest.localeCompare(aLatest);
    }) || [];

  // Clients without messages (for starting new conversations)
  const clientsWithoutMessages = clients?.filter(
    (c) => !messagesByClient.has(c.id)
  ) || [];

  const filteredClients = searchTerm
    ? [...clientsWithMessages, ...clientsWithoutMessages].filter((c) =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : clientsWithMessages;

  const selectedClient = clients?.find((c) => c.id === selectedClientId);
  const selectedMessages = selectedClientId
    ? (messagesByClient.get(selectedClientId) || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : [];

  // Mark messages as read when opening a client conversation
  useEffect(() => {
    if (!selectedClientId) return;
    const unreadMessages = selectedMessages.filter(
      (m) => !m.read && m.title.startsWith("Mensagem de ")
    );
    if (unreadMessages.length > 0) {
      supabase
        .from("client_notifications")
        .update({ read: true })
        .in("id", unreadMessages.map((m) => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["admin-all-messages"] });
          queryClient.invalidateQueries({ queryKey: ["admin-unread-messages-count"] });
        });
    }
  }, [selectedClientId, selectedMessages.length, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedMessages.length]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-all-messages"] });
          queryClient.invalidateQueries({ queryKey: ["admin-unread-messages-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getUnreadCount = (clientId: string) => {
    const messages = messagesByClient.get(clientId) || [];
    return messages.filter((m) => !m.read && m.title.startsWith("Mensagem de ")).length;
  };

  const getLastMessage = (clientId: string) => {
    const messages = messagesByClient.get(clientId) || [];
    return messages[0]; // Already sorted desc
  };

  const isClientMessage = (n: Notification) => n.title.startsWith("Mensagem de ");

  const handleSendMessage = async () => {
    if (!selectedClientId || !newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("client_notifications").insert({
        client_id: selectedClientId,
        title: "Mensagem da Doula",
        message: newMessage.trim(),
        read: true, // Admin already saw it
        read_by_client: false,
        organization_id: organizationId || null,
      });
      if (error) throw error;

      sendPushNotification({
        client_ids: [selectedClientId],
        title: "💬 Nova mensagem da sua Doula",
        message: newMessage.trim().substring(0, 100),
        url: "/gestante/mensagens",
        tag: "doula-message",
      });

      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-messages"] });
      toast.success("Mensagem enviada!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Mensagens</h1>
        <p className="page-description">Converse com suas clientes</p>
      </div>

      <Card className="card-glass overflow-hidden">
        <div className="flex h-[calc(100vh-14rem)] lg:h-[calc(100vh-12rem)]">
          {/* Sidebar - Client list */}
          <div
            className={cn(
              "w-full lg:w-80 border-r border-border flex flex-col",
              selectedClientId && "hidden lg:flex"
            )}
          >
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredClients.length === 0 && !searchTerm ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado
                </div>
              ) : (
                filteredClients.map((client) => {
                  const unread = getUnreadCount(client.id);
                  const lastMsg = getLastMessage(client.id);
                  const isSelected = selectedClientId === client.id;
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className={cn(
                        "w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                        isSelected && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {abbreviateName(client.full_name)
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">
                              {abbreviateName(client.full_name)}
                            </p>
                            {unread > 0 && (
                              <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                                {unread}
                              </Badge>
                            )}
                          </div>
                          {lastMsg && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {isClientMessage(lastMsg) ? "" : "Você: "}
                              {lastMsg.message.substring(0, 30)}
                              {lastMsg.message.length > 30 ? "…" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div
            className={cn(
              "flex-1 flex flex-col",
              !selectedClientId && "hidden lg:flex"
            )}
          >
            {!selectedClientId ? (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div>
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Selecione uma conversa</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-3 border-b border-border flex items-center gap-3 bg-card/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-8 w-8"
                    onClick={() => setSelectedClientId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {selectedClient
                        ? abbreviateName(selectedClient.full_name)
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {selectedClient ? abbreviateName(selectedClient.full_name) : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedClient?.status === "gestante"
                        ? "Gestante"
                        : selectedClient?.status === "lactante"
                        ? "Puérpera"
                        : "Cliente"}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {selectedMessages.length === 0 ? (
                      <div className="text-center py-12 text-sm text-muted-foreground">
                        Nenhuma mensagem ainda. Inicie a conversa!
                      </div>
                    ) : (
                      selectedMessages.map((msg) => {
                        const isMine = !isClientMessage(msg);
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              isMine ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-xl px-3 py-2",
                                isMine
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-muted rounded-bl-sm"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                              <div
                                className={cn(
                                  "flex items-center gap-1 mt-1",
                                  isMine ? "justify-end" : "justify-start"
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-[10px]",
                                    isMine
                                      ? "text-primary-foreground/60"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {formatBrazilDateTime(
                                    msg.created_at,
                                    "dd/MM HH:mm"
                                  )}
                                </span>
                                {isMine && (
                                  <CheckCheck
                                    className={cn(
                                      "h-3 w-3",
                                      (msg as any).read_by_client
                                        ? "text-primary-foreground/80"
                                        : "text-primary-foreground/40"
                                    )}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Compose */}
                <div className="p-3 border-t border-border bg-card/50">
                  <div className="flex gap-2 items-end">
                    <Textarea
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
                      disabled={sending || !newMessage.trim()}
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
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
