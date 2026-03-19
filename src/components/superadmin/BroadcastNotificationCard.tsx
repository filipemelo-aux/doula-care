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
  { value: "informative", label: "📚 Informativo" },
];

const TYPE_OPTIONS: { value: PushNotificationType; label: string }[] = [
  { value: "community", label: "🌐 Comunidade" },
  { value: "general", label: "📢 Geral" },
];

const COMMUNITY_THEME_OPTIONS = [
  { value: "gestacao", label: "🤰 Gestação" },
  { value: "parto", label: "👶 Parto" },
  { value: "amamentacao", label: "🤱 Amamentação" },
  { value: "pos-parto", label: "💜 Pós-parto" },
  { value: "bebe", label: "🍼 Bebê" },
  { value: "bem-estar", label: "🧘 Bem-estar" },
  { value: "livre", label: "💬 Livre" },
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
  const [communityTheme, setCommunityTheme] = useState("livre");
  const [audience, setAudience] = useState("all");
  const [targetOrgId, setTargetOrgId] = useState("all");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

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
      // If community type, create a forum post as "Doula Care"
      if (notifType === "community") {
        // Find the matching category for the theme
        const themeLabel = COMMUNITY_THEME_OPTIONS.find(t => t.value === communityTheme)?.label || "💬 Livre";
        
        // Get or find a matching forum category
        const { data: categories } = await supabase
          .from("forum_categories")
          .select("id, name")
          .eq("is_active", true);

        // Try to match by name similarity, fallback to first category
        let categoryId = categories?.[0]?.id;
        if (categories) {
          const themeMap: Record<string, string[]> = {
            gestacao: ["gestação", "gravidez"],
            parto: ["parto", "nascimento"],
            amamentacao: ["amamentação", "aleitamento"],
            "pos-parto": ["pós-parto", "puerpério"],
            bebe: ["bebê", "recém-nascido"],
            "bem-estar": ["bem-estar", "saúde"],
            livre: ["livre", "geral", "outros"],
          };
          const searchTerms = themeMap[communityTheme] || ["livre"];
          for (const cat of categories) {
            const catName = cat.name.toLowerCase();
            if (searchTerms.some(t => catName.includes(t))) {
              categoryId = cat.id;
              break;
            }
          }
        }

        if (!categoryId) {
          toast.error("Nenhuma categoria encontrada na comunidade");
          setSending(false);
          return;
        }

        // Get current user id (super admin) to use as author
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Erro de autenticação");
          setSending(false);
          return;
        }

        // Create the forum post
        const { data: insertedPost, error: postError } = await supabase
          .from("forum_posts")
          .insert({
            title: title.trim(),
            content: message.trim(),
            category_id: categoryId,
            author_id: user.id,
            is_anonymous: false,
            organization_id: null, // Global post
          })
          .select("id")
          .single();

        if (postError) {
          console.error("Error creating forum post:", postError);
          toast.error("Erro ao criar post na comunidade");
          setSending(false);
          return;
        }

        // Trigger notifications via notify-forum-post
        await supabase.functions.invoke("notify-forum-post", {
          body: {
            postId: insertedPost.id,
            authorId: user.id,
            authorName: "Doula Care",
            postTitle: title.trim(),
            isAnonymous: false,
          },
        });

        toast.success("Post publicado na comunidade e notificações enviadas!");
      } else {
        // General type — send push notification directing to home
        let userIds: string[] = [];

        if (targetOrgId !== "all") {
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

        userIds = [...new Set(userIds)];

        if (userIds.length === 0) {
          toast.error("Nenhum usuário encontrado para o público selecionado");
          setSending(false);
          return;
        }

        await sendPushNotification({
          user_ids: userIds,
          title,
          message,
          type: "general",
          url: "/",
        });

        toast.success(`Notificação enviada para ${userIds.length} usuário(s)!`);
      }

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
            <Label className="text-xs">Título {notifType === "community" ? "do post" : "da notificação"}</Label>
            <Input
              placeholder={notifType === "community" ? "Título do post na comunidade" : "Título da push notification"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/100</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{notifType === "community" ? "Conteúdo do post" : "Mensagem"}</Label>
            <Textarea
              placeholder={notifType === "community" ? "Conteúdo do post na comunidade" : "Corpo da notificação"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={notifType === "community" ? 2000 : 120}
              rows={notifType === "community" ? 4 : 2}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {message.length}/{notifType === "community" ? 2000 : 120}
            </p>
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

            {notifType === "community" ? (
              <div className="space-y-2">
                <Label className="text-xs">Tema</Label>
                <Select value={communityTheme} onValueChange={setCommunityTheme}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNITY_THEME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
            )}
          </div>

          {/* Organization targeting — only for general type */}
          {notifType === "general" && (
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
          )}
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
                <p className="text-xs text-muted-foreground break-words">
                  {notifType === "community"
                    ? `Doula Care publicou: "${(message || "Mensagem").substring(0, 80)}..."`
                    : (message || "Mensagem")}
                </p>
              </div>
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 bg-foreground/10 p-0.5">
                <img
                  src="/badge-mono-v2.png"
                  alt="badge"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            {notifType === "community" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Será criado um post na comunidade como "Doula Care" • Clique direciona para /comunidade
              </p>
            )}
            {notifType === "general" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Clique direciona para a página inicial do aplicativo
              </p>
            )}
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
          {notifType === "community" ? "Publicar na Comunidade" : "Enviar Notificação"}
        </Button>
      </CardContent>
    </Card>
  );
}
