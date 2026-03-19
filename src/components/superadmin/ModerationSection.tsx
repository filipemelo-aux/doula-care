import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, FileText, Wallet, BookOpen, Bell, Loader2, Search, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatBrazilDateTime } from "@/lib/utils";

export function ModerationSection() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: organizations = [] } = useQuery({
    queryKey: ["moderation-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredOrgs = searchTerm
    ? organizations.filter((o) => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : organizations;

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["moderation-messages", selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moderation_messages" as any, { p_org_id: selectedOrgId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["moderation-contracts", selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moderation_contracts" as any, { p_org_id: selectedOrgId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ["moderation-transactions", selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moderation_transactions" as any, { p_org_id: selectedOrgId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: diary = [], isLoading: loadingDiary } = useQuery({
    queryKey: ["moderation-diary", selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moderation_diary" as any, { p_org_id: selectedOrgId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery({
    queryKey: ["moderation-notifications", selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moderation_notifications" as any, { p_org_id: selectedOrgId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedOrgId,
  });

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const EmptyState = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Eye className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );

  const LoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  const isClientMessage = (title: string) => title.startsWith("Mensagem de ");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Moderação — Selecione uma organização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Escolha uma organização para moderar" />
            </SelectTrigger>
            <SelectContent>
              {filteredOrgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <span className="flex items-center gap-2">
                    {org.name}
                    <Badge variant="outline" className="text-[10px] h-4">
                      {org.status}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedOrgId && (
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="messages" className="w-full">
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0 flex">
                <TabsTrigger value="messages" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 py-3 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Mensagens
                  {messages.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{messages.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="contracts" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 py-3 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Contratos
                  {contracts.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{contracts.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="financial" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 py-3 text-xs">
                  <Wallet className="h-3.5 w-3.5" />
                  Financeiro
                  {transactions.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{transactions.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="diary" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 py-3 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  Diários
                  {diary.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{diary.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 py-3 text-xs">
                  <Bell className="h-3.5 w-3.5" />
                  Notificações
                  {notifications.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{notifications.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* Messages Tab */}
              <TabsContent value="messages" className="mt-0">
                <ScrollArea className="h-[60vh]">
                  {loadingMessages ? <LoadingState /> : messages.length === 0 ? (
                    <EmptyState text="Nenhuma mensagem encontrada nesta organização" />
                  ) : (
                    <div className="divide-y">
                      {messages.map((msg: any) => {
                        const fromClient = isClientMessage(msg.title);
                        return (
                          <div key={msg.id} className="p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start gap-2">
                              <Badge variant={fromClient ? "outline" : "default"} className="text-[10px] h-5 shrink-0 mt-0.5">
                                {fromClient ? "Cliente" : "Doula"}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium truncate">{msg.client_name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatBrazilDateTime(msg.created_at, "dd/MM/yy HH:mm")}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                                {msg.attachment_url && (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                                    {msg.attachment_type === "image" ? "📷 Ver imagem" : "📎 Ver arquivo"}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Contracts Tab */}
              <TabsContent value="contracts" className="mt-0">
                <ScrollArea className="h-[60vh]">
                  {loadingContracts ? <LoadingState /> : contracts.length === 0 ? (
                    <EmptyState text="Nenhum contrato encontrado nesta organização" />
                  ) : (
                    <div className="divide-y">
                      {contracts.map((c: any) => (
                        <div key={c.id} className="p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{c.client_name}</span>
                            <Badge variant={c.status === "signed" ? "default" : "outline"} className="text-[10px] h-5">
                              {c.status === "signed" ? "Assinado" : c.status === "pending" ? "Pendente" : c.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.title}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>Criado: {formatBrazilDateTime(c.created_at, "dd/MM/yy")}</span>
                            {c.signed_at && <span>Assinado: {formatBrazilDateTime(c.signed_at, "dd/MM/yy HH:mm")}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financial" className="mt-0">
                <ScrollArea className="h-[60vh]">
                  {loadingTransactions ? <LoadingState /> : transactions.length === 0 ? (
                    <EmptyState text="Nenhuma transação encontrada nesta organização" />
                  ) : (
                    <div className="divide-y">
                      {transactions.map((t: any) => (
                        <div key={t.id} className="p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={t.type === "receita" ? "default" : "destructive"} className="text-[10px] h-5">
                                {t.type === "receita" ? "Receita" : "Despesa"}
                              </Badge>
                              <span className="text-sm font-medium">{t.description}</span>
                            </div>
                            <span className={`text-sm font-semibold ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                              R$ {Number(t.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            {t.client_name && <span>Cliente: {t.client_name}</span>}
                            {t.payment_method && <span>Método: {t.payment_method}</span>}
                            <span>{formatBrazilDateTime(t.created_at, "dd/MM/yy")}</span>
                          </div>
                          {t.amount_received != null && t.type === "receita" && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Recebido: R$ {Number(t.amount_received).toFixed(2)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Diary Tab */}
              <TabsContent value="diary" className="mt-0">
                <ScrollArea className="h-[60vh]">
                  {loadingDiary ? <LoadingState /> : diary.length === 0 ? (
                    <EmptyState text="Nenhum registro de diário encontrado nesta organização" />
                  ) : (
                    <div className="divide-y">
                      {diary.map((d: any) => (
                        <div key={d.id} className="p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{d.client_name}</span>
                            {d.emotion && <span className="text-base">{d.emotion}</span>}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatBrazilDateTime(d.created_at, "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{d.content}</p>
                          {d.symptoms && d.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {d.symptoms.map((s: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px] h-4">{s}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="mt-0">
                <ScrollArea className="h-[60vh]">
                  {loadingNotifications ? <LoadingState /> : notifications.length === 0 ? (
                    <EmptyState text="Nenhuma notificação encontrada nesta organização" />
                  ) : (
                    <div className="divide-y">
                      {notifications.map((n: any) => (
                        <div key={n.id} className="p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium">{n.client_name}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{n.title}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatBrazilDateTime(n.created_at, "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
