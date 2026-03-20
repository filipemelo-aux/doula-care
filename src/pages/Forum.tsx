import { useState, useMemo, useEffect, useRef } from "react";
import { InstagramLinkPreview, extractInstagramUrls, removeInstagramMarkdownLinks } from "@/components/forum/InstagramLinkPreview";
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
import { Search, Plus, MessageSquare, Heart, EyeOff, Loader2, Send, Pin, MoreVertical, EyeOffIcon, Trash2, X, Users, ShieldCheck, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  // No longer needed: body has overflow:hidden globally

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // New post form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [newAudience, setNewAudience] = useState<"all" | "doulas_only" | "gestantes_only">("all");
  const [postLoading, setPostLoading] = useState(false);

  // Comment form
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentAnon, setCommentAnon] = useState<Record<string, boolean>>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  // Edit post state
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAudience, setEditAudience] = useState<"all" | "doulas_only">("all");
  const [editLoading, setEditLoading] = useState(false);

  // Community pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshingCommunity, setRefreshingCommunity] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const canPullRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-forum"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: clientData } = await supabase
        .from("clients")
        .select("preferred_name, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const userRoles = roles?.map(r => r.role) || [];
      const isDoulaUser = userRoles.some(r => ["admin", "moderator"].includes(r));
      // For doula users, fetch org logo to use as avatar in forum
      let avatarUrl = profile?.avatar_url || null;
      if (isDoulaUser && profile?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("logo_url")
          .eq("id", profile.organization_id)
          .maybeSingle();
        if (org?.logo_url) avatarUrl = org.logo_url;
      }
      return {
        ...user,
        roles: userRoles,
        avatarUrl,
        displayName: clientData?.preferred_name || clientData?.full_name || profile?.full_name || "Usuária",
      };
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

  const { data: posts = [], refetch: refetchPosts, isFetching: isFetchingPosts } = useQuery({
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

  // Fetch author profiles globally via security definer function
  const allAuthorIds = posts.filter((p: any) => !p.is_anonymous).map((p: any) => p.author_id);
  const uniqueAuthorIds = [...new Set(allAuthorIds)];
  const { data: profileMap = {} } = useQuery({
    queryKey: ["forum-profiles", uniqueAuthorIds],
    queryFn: async () => {
      if (uniqueAuthorIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_forum_author_profiles", {
        p_user_ids: uniqueAuthorIds,
      });
      if (error) throw error;
      const map: Record<string, { name: string; avatarUrl: string | null; isDoula: boolean }> = {};
      data?.forEach((row: any) => {
        map[row.user_id] = {
          name: row.display_name || "Usuária",
          avatarUrl: row.avatar_url || null,
          isDoula: row.is_doula || false,
        };
      });
      return map;
    },
    enabled: uniqueAuthorIds.length > 0,
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

  // Fetch all reactions with user_ids for tooltip display
  const { data: allReactions = [] } = useQuery({
    queryKey: ["forum-all-reactions", postIds],
    queryFn: async () => {
      if (postIds.length === 0) return [];
      const { data } = await supabase
        .from("forum_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds);
      return data || [];
    },
    enabled: postIds.length > 0,
  });

  const reactionsByPost = useMemo(() => {
    const map: Record<string, string[]> = {};
    allReactions.forEach((r: any) => {
      if (!map[r.post_id]) map[r.post_id] = [];
      if (!map[r.post_id].includes(r.user_id)) map[r.post_id].push(r.user_id);
    });
    return map;
  }, [allReactions]);

  const allLikerIds = useMemo(() => [...new Set(allReactions.map((r: any) => r.user_id))], [allReactions]);
  const { data: likerProfileMap = {} } = useQuery({
    queryKey: ["forum-liker-profiles", allLikerIds],
    queryFn: async () => {
      if (allLikerIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_forum_author_profiles", { p_user_ids: allLikerIds });
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row: any) => { map[row.user_id] = row.display_name || "Usuária"; });
      return map;
    },
    enabled: allLikerIds.length > 0,
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

  // Comment author profiles via security definer function
  const commentAuthorIds = expandedComments.filter((c: any) => !c.is_anonymous).map((c: any) => c.author_id);
  const uniqueCommentAuthorIds = [...new Set(commentAuthorIds)];
  const { data: commentProfileMap = {} } = useQuery({
    queryKey: ["forum-comment-profiles", uniqueCommentAuthorIds],
    queryFn: async () => {
      if (uniqueCommentAuthorIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_forum_author_profiles", {
        p_user_ids: uniqueCommentAuthorIds,
      });
      if (error) throw error;
      const map: Record<string, { name: string; avatarUrl: string | null; isDoula: boolean }> = {};
      data?.forEach((row: any) => {
        map[row.user_id] = {
          name: row.display_name || "Usuária",
          avatarUrl: row.avatar_url || null,
          isDoula: row.is_doula || false,
        };
      });
      return map;
    },
    enabled: uniqueCommentAuthorIds.length > 0,
  });

  type ProfileEntry = { name: string; avatarUrl: string | null; isDoula: boolean };
  const getAuthorInfo = (authorId: string, anonymous: boolean, map: Record<string, ProfileEntry> = profileMap as any): ProfileEntry => {
    if (anonymous) return { name: "Anônima", avatarUrl: null, isDoula: false };
    return (map as Record<string, ProfileEntry>)[authorId] || { name: "Usuária", avatarUrl: null, isDoula: false };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const scrollParent = containerRef.current?.closest('main') || containerRef.current?.parentElement;
    const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
    canPullRef.current = scrollTop <= 0;
    pullStartYRef.current = canPullRef.current ? e.touches[0].clientY : null;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartYRef.current === null || !canPullRef.current || refreshingCommunity) return;
    const delta = e.touches[0].clientY - pullStartYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 84));
    }
  };

  const handleTouchEnd = async () => {
    if (refreshingCommunity) return;
    const shouldRefresh = pullDistance >= 60;
    setPullDistance(0);
    pullStartYRef.current = null;
    canPullRef.current = false;

    if (!shouldRefresh) return;

    setRefreshingCommunity(true);
    try {
      await refetchPosts();
      toast.success("Comunidade atualizada");
    } finally {
      setRefreshingCommunity(false);
    }
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
      const insertPayload: any = {
        title: newTitle.trim(),
        content: newContent.trim(),
        category_id: newCategoryId,
        author_id: currentUser!.id,
        is_anonymous: newAnonymous,
        audience: isAdmin ? newAudience : "all",
      };
      const { data: insertedPost, error } = await supabase.from("forum_posts").insert(insertPayload).select("id").single();
      if (error) throw error;
      toast.success("Publicado!");
      setNewTitle(""); setNewContent(""); setNewCategoryId(""); setNewAnonymous(false); setNewAudience("all");
      setShowNewPost(false);
      refetchPosts();

      // Notify users about the new post (fire and forget)
      supabase.functions.invoke("notify-forum-post", {
        body: {
          postId: insertedPost.id,
          authorId: currentUser!.id,
          authorName: currentUser!.displayName,
          postTitle: newTitle.trim(),
          isAnonymous: newAnonymous,
          audience: isAdmin ? newAudience : "all",
        },
      }).catch((err) => console.error("Error notifying forum post:", err));
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

  const handleEditPost = (post: any) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditAudience(post.audience || "all");
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editTitle.trim() || !editContent.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setEditLoading(true);
    try {
      const updates: any = {
        title: editTitle.trim(),
        content: editContent.trim(),
      };
      if (isAdmin) {
        updates.audience = editAudience;
      }
      const { error } = await supabase.from("forum_posts").update(updates).eq("id", editingPost.id);
      if (error) throw error;
      toast.success("Publicação atualizada!");
      setEditingPost(null);
      refetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="p-3 lg:p-8 max-w-2xl mx-auto space-y-4 overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || refreshingCommunity ? 56 : 0 }}
      >
        <div className="flex h-14 items-center justify-center text-sm text-muted-foreground">
          {refreshingCommunity || isFetchingPosts
            ? "Atualizando comunidade..."
            : pullDistance >= 60
              ? "Solte para atualizar"
              : "Puxe para atualizar"}
        </div>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Comunidade</h1>
          <p className="page-description">Compartilhe experiências e conecte-se</p>
        </div>
      </div>

      {/* Create post button (compact) */}
      <button
        onClick={() => setShowNewPost(true)}
        className="w-full bg-card rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
      >
        <Avatar className="h-10 w-10 bg-primary/10">
          {currentUser?.avatarUrl && (
            <AvatarImage src={currentUser.avatarUrl} alt={currentUser.displayName} className="object-cover" />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {currentUser ? getInitials(currentUser.displayName) : "?"}
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
          {categories.map((cat: any) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="shrink-0 rounded-full text-xs h-8"
              >
                {cat.icon}{isSelected ? ` ${cat.name}` : ""}
              </Button>
            );
          })}
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
            const isSystemPost = post.is_system_post === true;
            const authorInfo = isSystemPost
              ? { name: "Doula Care", avatarUrl: "/logo.png", isDoula: true }
              : getAuthorInfo(post.author_id, post.is_anonymous);
            const authorName = authorInfo.name;
            const liked = userReactions.includes(post.id);
            const commentCount = post.forum_comments?.[0]?.count || 0;
            const reactionCount = post.forum_reactions?.[0]?.count || 0;
            const isExpanded = expandedPostId === post.id;

            return (
              <div key={post.id} className="bg-card break-words rounded-xl overflow-hidden">
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
                        {post.audience === "doulas_only" && <ShieldCheck className="h-3 w-3 text-primary shrink-0" />}
                        {post.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="truncate">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
                        <span>·</span>
                        <span className="truncate">{post.forum_categories?.icon} {post.forum_categories?.name}</span>
                      </div>
                    </div>
                    {(isAdmin || post.author_id === currentUser?.id) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {post.author_id === currentUser?.id && (
                            <DropdownMenuItem onClick={() => handleEditPost(post)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => handlePinPost(post.id, post.is_pinned)}>
                                <Pin className="h-4 w-4 mr-2" />
                                {post.is_pinned ? "Desafixar" : "Fixar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleHidePost(post.id)} className="text-destructive">
                                <EyeOffIcon className="h-4 w-4 mr-2" />
                                Ocultar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Post content */}
                  <h3 className="font-semibold text-foreground mb-1 break-words">{post.title}</h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">
                    {extractInstagramUrls(post.content).length > 0
                      ? removeInstagramMarkdownLinks(post.content)
                      : post.content}
                  </p>
                  <InstagramLinkPreview content={post.content} />
                </div>

                {post.image_url && (
                  <div className="mt-3">
                    <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
                  </div>
                )}

                {/* Reactions bar */}
                <div className="px-4 py-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {reactionCount > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="flex items-center gap-1 cursor-pointer hover:underline">
                          <span className="bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]">❤</span>
                          {reactionCount}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" className="w-auto max-w-[200px] p-2">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {(reactionsByPost[post.id] || []).slice(0, 10).map((uid: string) => (
                            <span key={uid}>{(likerProfileMap as Record<string, string>)[uid] || "Usuária"}</span>
                          ))}
                          {(reactionsByPost[post.id]?.length || 0) > 10 && (
                            <span className="text-muted-foreground">e mais {(reactionsByPost[post.id]?.length || 0) - 10}...</span>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {reactionCount > 0 && commentCount > 0 && <span className="mx-1">·</span>}
                  {commentCount > 0 && (
                    <span>{commentCount} comentário{commentCount !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mx-4" />
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
                  <div className="bg-muted/30">
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
                    <div className="px-4 py-3 flex items-start gap-2.5 border-t">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        {currentUser?.avatarUrl && (
                          <AvatarImage src={currentUser.avatarUrl} alt={currentUser.displayName} className="object-cover" />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {currentUser ? getInitials(currentUser.displayName) : "?"}
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

            {isAdmin && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Público-alvo</Label>
                  <p className="text-xs text-muted-foreground">Quem pode ver esta publicação</p>
                </div>
                <Select value={newAudience} onValueChange={(v) => setNewAudience(v as "all" | "doulas_only")}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="doulas_only">Só Doulas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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

      {/* Edit Post Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => { if (!open) setEditingPost(null); }}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título"
              maxLength={200}
            />

            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Conteúdo"
              rows={4}
              maxLength={5000}
            />

            {isAdmin && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Público-alvo</Label>
                  <p className="text-xs text-muted-foreground">Quem pode ver esta publicação</p>
                </div>
                <Select value={editAudience} onValueChange={(v) => setEditAudience(v as "all" | "doulas_only")}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="doulas_only">Só Doulas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={handleSaveEdit} disabled={editLoading} className="w-full">
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
