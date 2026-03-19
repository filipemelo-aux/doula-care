import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone, Sparkles, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import { sendPushNotification, type PushNotificationType } from "@/lib/pushNotifications";

const TONE_OPTIONS = [
  { value: "exciting", label: "🎉 Empolgante" },
  { value: "friendly", label: "💛 Amigável" },
  { value: "formal", label: "📋 Formal" },
  { value: "mystery", label: "🔮 Misterioso" },
];

const TYPE_OPTIONS: { value: PushNotificationType; label: string }[] = [
  { value: "community", label: "🌐 Comunidade" },
  { value: "general", label: "📢 Geral" },
];

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos os usuários" },
  { value: "admins", label: "Apenas doulas (admins)" },
  { value: "clients", label: "Apenas gestantes (clientes)" },
];

interface Organization {
  id: string;
  name: string;
  nome_exibicao: string | null;
}

export function BroadcastNotificationCard() {
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("exciting");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState<PushNotificationType>("community");
  const [audience, setAudience] = useState("all");
  const [targetOrgId, setTargetOrgId] = useState("all");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // Lazy load orgs when dropdown opens
  const loadOrgs = async () => {
    if (orgsLoaded) return;
    const { data } = await supabase
      .from("organizations")
      .select("id, name, nome_exibicao")
      .eq("status", "ativo")
      .order("name");
    if (data) {
      setOrgs(data);
      setOrgsLoaded(true);
    }
  };

  const handleGenerate = async () => {
    if (!keywords.trim()) {
      toast.error("Digite palavras-chave para gerar o texto");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-notification-text", {
        body: { keywords, tone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTitle(data.title || "");
      setMessage(data.message || "");
      toast.success("Texto gerado com IA!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar texto");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }

    setSending(true);
    try {
      let userIds: string[] = [];

      if (targetOrgId !== "all") {
        // Target specific organization
        if (audience === "all" || audience === "admins") {
          const { data: orgProfiles } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("organization_id", targetOrgId);

          if (orgProfiles) {
            const orgUserIds = orgProfiles.map(p => p.user_id);
            const { data: adminRoles } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("role", ["admin", "moderator"])
              .in("user_id", orgUserIds);

            if (adminRoles) {
              userIds.push(...adminRoles.map(r => r.user_id));
            }
          }
        }

        if (audience === "all" || audience === "clients") {
          const { data: clients } = await supabase
            .from("clients")
            .select("user_id")
            .eq("organization_id", targetOrgId)
            .not("user_id", "is", null);

          if (clients) {
            userIds.push(...clients.map(c => c.user_id).filter((id): id is string => !!id));
          }
        }
      } else {
        // Target all organizations (existing logic)
        if (audience === "all" || audience === "admins") {
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "moderator"]);

          if (adminRoles) {
            userIds.push(...adminRoles.map(r => r.user_id));
          }
        }

        if (audience === "all" || audience === "clients") {
          const { data: clients } = await supabase
            .from("clients")
            .select("user_id")
            .not("user_id", "is", null);

          if (clients) {
            userIds.push(...clients.map(c => c.user_id).filter((id): id is string => !!id));
          }
        }
      }

      // Deduplicate
      userIds = [...new Set(userIds)];

      if (userIds.length === 0) {
        toast.error("Nenhum usuário encontrado para o público selecionado");
        setSending(false);
        return;
      }

      // Determine the themed image for notification body
      const notifImage = notifType === "community"
        ? "/notif-icon-community.png"
        : "/notif-icon-announcement.png";

      // Send push notification
      await sendPushNotification({
        user_ids: userIds,
        title,
        message,
        type: notifType,
        url: notifType === "community" ? "/comunidade" : "/",
        image: notifImage,
      });

      const orgLabel = targetOrgId !== "all"
        ? orgs.find(o => o.id === targetOrgId)?.nome_exibicao || orgs.find(o => o.id === targetOrgId)?.name || ""
        : "";

      toast.success(
        `Notificação enviada para ${userIds.length} usuário(s)${orgLabel ? ` de ${orgLabel}` : ""}!`
      );
      // Reset form
      setKeywords("");
      setTitle("");
      setMessage("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar notificação");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-5 w-5 text-primary" />
          Enviar Notificação Broadcast
        </CardTitle>
        <CardDescription>
          Use IA para gerar textos impactantes a partir de palavras-chave
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Generation Section */}
        <div className="p-4 rounded-lg bg-primary/5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Gerador de Texto com IA
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Palavras-chave / Tema</Label>
            <Input
              placeholder="Ex: nova comunidade, feed social, interação entre gestantes..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs">Tom</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !keywords.trim()}
              size="sm"
              className="mt-5"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Gerar
            </Button>
          </div>
        </div>

        {/* Notification Fields */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Título da notificação</Label>
            <Input
              placeholder="Título da push notification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/50</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              placeholder="Corpo da notificação"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={120}
              rows={2}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/120</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={notifType} onValueChange={(v) => setNotifType(v as PushNotificationType)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Público</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Organization targeting */}
          <div className="space-y-2">
            <Label className="text-xs">Organização</Label>
            <Select value={targetOrgId} onValueChange={setTargetOrgId} onOpenChange={(open) => { if (open) loadOrgs(); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todas as organizações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌍 Todas as organizações</SelectItem>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.nome_exibicao || org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              Preview
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-card overflow-hidden flex-shrink-0">
                <img src="/logo.png" alt="icon" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{title || "Título"}</p>
                <p className="text-xs text-muted-foreground break-words">{message || "Mensagem"}</p>
              </div>
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 bg-foreground/10 p-0.5">
                <img
                  src="/badge-mono-v2.png"
                  alt="badge"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            {/* Image preview in body */}
            <div className="mt-2 rounded-md overflow-hidden bg-card">
              <img
                src={notifType === "community" ? "/notif-icon-community.png" : "/notif-icon-announcement.png"}
                alt="notification image"
                className="w-full h-24 object-contain p-2"
              />
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Enviar Notificação
        </Button>
      </CardContent>
    </Card>
  );
}
