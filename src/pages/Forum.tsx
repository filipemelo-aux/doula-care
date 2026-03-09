import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, Heart, EyeOff, Loader2, Send, Pin, MoreVertical, EyeOffIcon, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Forum() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // New post form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [postLoading, setPostLoading] = useState(false);

  // Comment form
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentAnon, setCommentAnon] = useState<Record<string, boolean>>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-forum"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return { ...user, roles: roles?.map(r => r.role) || [] };
    },
  });

  const isAdmin = currentUser?.roles?.some((r: string) => ["admin", "moderator", "super_admin"].includes(r));

  const { data: categories = [] } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: posts = [], refetch: refetchPosts } = useQuery({
    queryKey: ["forum-posts", selectedCategory, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("forum_posts")
        .select(`
          *,
          forum_categories!inner(name, icon),
          forum_comments(count),
          forum_reactions(count)
        `)
        .eq("is_hidden", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }
      if (searchTerm.trim()) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch author profiles (with avatars and org logos for doulas)
  const allAuthorIds = posts.filter((p: any) => !p.is_anonymous).map((p: any) => p.author_id);
  const { data: profileMap = {} } = useQuery({
    queryKey: ["forum-profiles", allAuthorIds],
    queryFn: async () => {
      if (allAuthorIds.length === 0) return {};
      const { data: profileData } = await supabase.from("profiles").select("user_id, full_name, avatar_url, organization_id").in("user_id", allAuthorIds);
      const { data: clientData } = await supabase.from("clients").select("user_id, full_name, preferred_name").in("user_id", allAuthorIds);
      const { data: roleData } = await supabase.from("user_roles").select("user_id, role").in("user_id", allAuthorIds);

      // Fetch org logos for admin/moderator users
      const adminOrgIds = profileData
        ?.filter(p => {
          const roles = roleData?.filter(r => r.user_id === p.user_id).map(r => r.role) || [];
          return roles.some(r => ["admin", "moderator"].includes(r)) && p.organization_id;
        })
        .map(p => p.organization_id!)
        .filter(Boolean) || [];
      
      let orgLogos: Record<string, string> = {};
      if (adminOrgIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, logo_url").in("id", adminOrgIds);
        orgs?.forEach(o => { if (o.logo_url) orgLogos[o.id] = o.logo_url; });
      }

      const map: Record<string, { name: string; avatarUrl: string | null; isDoula: boolean }> = {};
      profileData?.forEach(p => {
        const roles = roleData?.filter(r => r.user_id === p.user_id).map(r => r.role) || [];
        const isDoula = roles.some(r => ["admin", "moderator"].includes(r));
        const orgLogo = isDoula && p.organization_id ? orgLogos[p.organization_id] : null;
        map[p.user_id] = {
          name: p.full_name || "Usuária",
          avatarUrl: orgLogo || p.avatar_url || null,
          isDoula,
        };
      });
      clientData?.forEach(c => {
        if (c.user_id && !map[c.user_id]?.isDoula) {
          map[c.user_id] = {
            name: c.preferred_name || c.full_name,
            avatarUrl: map[c.user_id]?.avatarUrl || null,
            isDoula: false,
          };
        }
      });
      return map;
    },
    enabled: allAuthorIds.length > 0,
  });

  // Fetch reactions for all posts to know which ones user liked
  const postIds = posts.map((p: any) => p.id);
  const { data: userReactions = [], refetch: refetchReactions } = useQuery({
    queryKey: ["forum-user-reactions", postIds, currentUser?.id],
    queryFn: async () => {
      if (!currentUser || postIds.length === 0) return [];
      const { data } = await supabase
        .from("forum_reactions")
        .select("post_id")
        .eq("user_id", currentUser.id)
        .in("post_id", postIds);
      return data?.map(r => r.post_id) || [];
    },
    enabled: !!currentUser && postIds.length > 0,
  });

  // Expanded post comments
  const { data: expandedComments = [], refetch: refetchComments } = useQuery({
    queryKey: ["forum-comments", expandedPostId],
    queryFn: async () => {
      if (!expandedPostId) return [];
      const { data, error } = await supabase
        .from("forum_comments")
        .select("*")
        .eq("post_id", expandedPostId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!expandedPostId,
  });

  // Comment author profiles (with avatars)
  const commentAuthorIds = expandedComments.filter((c: any) => !c.is_anonymous).map((c: any) => c.author_id);
  const { data: commentProfileMap = {} } = useQuery({
    queryKey: ["forum-comment-profiles", commentAuthorIds],
    queryFn: async () => {
      if (commentAuthorIds.length === 0) return {};
      const { data: profileData } = await supabase.from("profiles").select("user_id, full_name, avatar_url, organization_id").in("user_id", commentAuthorIds);
      const { data: clientData } = await supabase.from("clients").select("user_id, full_name, preferred_name").in("user_id", commentAuthorIds);
      const { data: roleData } = await supabase.from("user_roles").select("user_id, role").in("user_id", commentAuthorIds);

      const adminOrgIds = profileData
        ?.filter(p => {
          const roles = roleData?.filter(r => r.user_id === p.user_id).map(r => r.role) || [];
          return roles.some(r => ["admin", "moderator"].includes(r)) && p.organization_id;
        })
        .map(p => p.organization_id!)
        .filter(Boolean) || [];
      
      let orgLogos: Record<string, string> = {};
      if (adminOrgIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, logo_url").in("id", adminOrgIds);
        orgs?.forEach(o => { if (o.logo_url) orgLogos[o.id] = o.logo_url; });
      }

      const map: Record<string, { name: string; avatarUrl: string | null; isDoula: boolean }> = {};
      profileData?.forEach(p => {
        const roles = roleData?.filter(r => r.user_id === p.user_id).map(r => r.role) || [];
        const isDoula = roles.some(r => ["admin", "moderator"].includes(r));
        const orgLogo = isDoula && p.organization_id ? orgLogos[p.organization_id] : null;
        map[p.user_id] = {
          name: p.full_name || "Usuária",
          avatarUrl: orgLogo || p.avatar_url || null,
          isDoula,
        };
      });
      clientData?.forEach(c => {
        if (c.user_id && !map[c.user_id]?.isDoula) {
          map[c.user_id] = {
            name: c.preferred_name || c.full_name,
            avatarUrl: map[c.user_id]?.avatarUrl || null,
            isDoula: false,
          };
        }
      });
      return map;
    },
    enabled: commentAuthorIds.length > 0,
  });

  type ProfileEntry = { name: string; avatarUrl: string | null; isDoula: boolean };
  const getAuthorInfo = (authorId: string, anonymous: boolean, map: Record<string, ProfileEntry> = profileMap as any): ProfileEntry => {
    if (anonymous) return { name: "Anônima", avatarUrl: null, isDoula: false };
    return (map as Record<string, ProfileEntry>)[authorId] || { name: "Usuária", avatarUrl: null, isDoula: false };
  };

  const getAuthorName = (authorId: string, anonymous: boolean, map: Record<string, any> = profileMap as any) => {
    if (anonymous) return "Anônima";
    const entry = (map as Record<string, any>)[authorId];
    if (!entry) return "Usuária";
    return typeof entry === "string" ? entry : entry.name || "Usuária";
  };

  const getInitials = (name: string) => {
    if (name === "Anônima") return "?";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim() || !newCategoryId) {
      toast.error("Preencha todos os campos");
      return;
    }
    setPostLoading(true);
    try {
      const { error } = await supabase.from("forum_posts").insert({
        title: newTitle.trim(),
        content: newContent.trim(),
        category_id: newCategoryId,
        author_id: currentUser!.id,
        is_anonymous: newAnonymous,
      });
      if (error) throw error;
      toast.success("Publicado!");
      setNewTitle(""); setNewContent(""); setNewCategoryId(""); setNewAnonymous(false);
      setShowNewPost(false);
      refetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPostLoading(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUser) return;
    const liked = userReactions.includes(postId);
    if (liked) {
      await supabase.from("forum_reactions").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    } else {
      await supabase.from("forum_reactions").insert({ post_id: postId, user_id: currentUser.id, reaction_type: "❤️" });
    }
    refetchReactions();
    refetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    setCommentLoading(postId);
    try {
      const { error } = await supabase.from("forum_comments").insert({
        post_id: postId,
        author_id: currentUser!.id,
        content: text,
        is_anonymous: commentAnon[postId] || false,
      });
      if (error) throw error;
      setCommentTexts(prev => ({ ...prev, [postId]: "" }));
      setCommentAnon(prev => ({ ...prev, [postId]: false }));
      refetchComments();
      refetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCommentLoading(null);
    }
  };

  const handlePinPost = async (postId: string, isPinned: boolean) => {
    await supabase.from("forum_posts").update({ is_pinned: !isPinned }).eq("id", postId);
    refetchPosts();
    toast.success(!isPinned ? "Post fixado!" : "Post desafixado");
  };

  const handleHidePost = async (postId: string) => {
    await supabase.from("forum_posts").update({ is_hidden: true }).eq("id", postId);
    refetchPosts();
    toast.success("Post ocultado");
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("forum_comments").delete().eq("id", commentId);
    refetchComments();
    refetchPosts();
  };

  return (
    <div className="p-3 lg:p-8 max-w-2xl mx-auto space-y-4 overflow-x-hidden overflow-x-hidden overflow-x-hidden">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Comunidade</h1>
          <p className="page-description">Compartilhe experiências e conecte-se</p>
        </div>
      </div>

      {/* Create post button (compact) */}
      <button
        onClick={() => setShowNewPost(true)}
        className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
      >
        <Avatar className="h-10 w-10 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {currentUser ? getInitials(getAuthorName(currentUser.id, false)) : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground text-sm flex-1">No que você está pensando?</span>
        <Plus className="h-5 w-5 text-primary" />
      </button>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na comunidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="shrink-0 rounded-full text-xs h-8"
          >
            Todos
          </Button>
          {categories.map((cat: any) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="shrink-0 rounded-full text-xs h-8"
            >
              {cat.icon} {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma publicação ainda</p>
            <p className="text-sm">Seja a primeira a compartilhar!</p>
          </div>
        ) : (
          posts.map((post: any) => {
            const authorInfo = getAuthorInfo(post.author_id, post.is_anonymous);
            const authorName = authorInfo.name;
            const liked = userReactions.includes(post.id);
            const commentCount = post.forum_comments?.[0]?.count || 0;
            const reactionCount = post.forum_reactions?.[0]?.count || 0;
            const isExpanded = expandedPostId === post.id;

            return (
              <div key={post.id} className="bg-card b break-wordsorder border-border rounded-xl overflow-hidden">
                {/* Post header */}
                <div className="p-4 pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      {authorInfo.avatarUrl && (
                        <AvatarImage src={authorInfo.avatarUrl} alt={authorName} className="object-cover" />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate">{authorName}</span>
                        {post.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="truncate">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
                        <span>·</span>
                        <span className="truncate">{post.forum_categories?.icon} {post.forum_categories?.name}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePinPost(post.id, post.is_pinned)}>
                            <Pin className="h-4 w-4 mr-2" />
                            {post.is_pinned ? "Desafixar" : "Fixar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleHidePost(post.id)} className="text-destructive">
                            <EyeOffIcon className="h-4 w-4 mr-2" />
                            Ocultar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Post content */}
                  <h3 className="font-semibold text-foreground mb-1 break-words">{post.title}</h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{post.content}</p>
                </div>

                {post.image_url && (
                  <div className="mt-3">
                    <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
                  </div>
                )}

                {/* Reactions bar */}
                <div className="px-4 py-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {reactionCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px]">❤</span>
                      {reactionCount}
                    </span>
                  )}
                  {reactionCount > 0 && commentCount > 0 && <span className="mx-1">·</span>}
                  {commentCount > 0 && (
                    <span>{commentCount} comentário{commentCount !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="border-t border-border mx-4" />
                <div className="px-2 py-1 flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleLike(post.id)}
                    className={cn("flex-1 gap-2 rounded-lg", liked && "text-red-500")}
                  >
                    <Heart className={cn("h-4 w-4", liked && "fill-current")} />
                    Curtir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                    className="flex-1 gap-2 rounded-lg"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Comentar
                  </Button>
                </div>

                {/* Comments section (expanded) */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30">
                    {/* Comments list */}
                    <div className="max-h-72 overflow-y-auto">
                      {expandedComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
                      ) : (
                        expandedComments.map((comment: any) => {
                          const cInfo = getAuthorInfo(comment.author_id, comment.is_anonymous, commentProfileMap as any);
                          const cName = cInfo.name;
                          return (
                            <div key={comment.id} className="px-4 py-2.5 flex gap-2.5 group">
                              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                                {cInfo.avatarUrl && (
                                  <AvatarImage src={cInfo.avatarUrl} alt={cName} className="object-cover" />
                                )}
                                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
                                  {getInitials(cName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="bg-muted rounded-xl px-3 py-2 break-words">
                                  <span className="text-xs font-semibold text-foreground">{cName}</span>
                                  <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{comment.content}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground ml-3">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              {(isAdmin || comment.author_id === currentUser?.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add comment */}
                    <div className="px-4 py-3 flex items-start gap-2.5 border-t border-border/50">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {currentUser ? getInitials(getAuthorName(currentUser.id, false)) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 min-w-0">
                          <input
                            value={commentTexts[post.id] || ""}
                            onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Escreva um comentário..."
                            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                            maxLength={2000}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-primary"
                            disabled={commentLoading === post.id || !commentTexts[post.id]?.trim()}
                            onClick={() => handleAddComment(post.id)}
                          >
                            {commentLoading === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                          <Switch
                            checked={commentAnon[post.id] || false}
                            onCheckedChange={(v) => setCommentAnon(prev => ({ ...prev, [post.id]: v }))}
                            className="scale-75 origin-left"
                          />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <EyeOff className="h-2.5 w-2.5" /> Anônimo
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Post Dialog */}
      <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>Criar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newCategoryId} onValueChange={setNewCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título"
              maxLength={200}
            />

            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="No que você está pensando?"
              rows={4}
              maxLength={5000}
            />

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Label htmlFor="new-anonymous" className="text-sm font-medium cursor-pointer">Postar anonimamente</Label>
                <p className="text-xs text-muted-foreground">Seu nome não será exibido</p>
              </div>
              <Switch id="new-anonymous" checked={newAnonymous} onCheckedChange={setNewAnonymous} />
            </div>

            <Button onClick={handleCreatePost} disabled={postLoading} className="w-full">
              {postLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
