import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Heart, MessageSquare, Pin, EyeOff, Loader2, Trash2, EyeOffIcon, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ForumPostDetailProps {
  postId: string;
  onBack: () => void;
}

export default function ForumPostDetail({ postId, onBack }: ForumPostDetailProps) {
  const [commentContent, setCommentContent] = useState("");
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
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

  const { data: post } = useQuery({
    queryKey: ["forum-post", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_posts")
        .select("*, forum_categories(name, icon)")
        .eq("id", postId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["forum-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_comments")
        .select("*")
        .eq("post_id", postId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: reactions = [], refetch: refetchReactions } = useQuery({
    queryKey: ["forum-reactions", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_reactions")
        .select("*")
        .eq("post_id", postId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch author profiles
  const allAuthorIds = [
    ...(post ? [post.author_id] : []),
    ...comments.filter((c: any) => !c.is_anonymous).map((c: any) => c.author_id),
  ].filter(Boolean);

  const { data: authorMap = {} } = useQuery({
    queryKey: ["forum-authors", allAuthorIds],
    queryFn: async () => {
      if (allAuthorIds.length === 0) return {};
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", allAuthorIds);
      const { data: clientData } = await supabase
        .from("clients")
        .select("user_id, full_name, preferred_name")
        .in("user_id", allAuthorIds);

      const map: Record<string, string> = {};
      profileData?.forEach(p => { if (p.full_name) map[p.user_id] = p.full_name; });
      clientData?.forEach(c => { if (c.user_id) map[c.user_id] = c.preferred_name || c.full_name; });
      return map;
    },
    enabled: allAuthorIds.length > 0,
  });

  const getAuthorName = (authorId: string, anonymous: boolean) => {
    if (anonymous) return "Anônima";
    return (authorMap as Record<string, string>)[authorId] || "Usuária";
  };

  const userHasLiked = reactions.some((r: any) => r.user_id === currentUser?.id);

  const handleToggleLike = async () => {
    if (!currentUser) return;
    if (userHasLiked) {
      await supabase
        .from("forum_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUser.id);
    } else {
      await supabase
        .from("forum_reactions")
        .insert({ post_id: postId, user_id: currentUser.id, reaction_type: "❤️" });
    }
    refetchReactions();
  };

  const handleAddComment = async () => {
    if (!commentContent.trim()) return;
    setLoadingComment(true);
    try {
      const { error } = await supabase.from("forum_comments").insert({
        post_id: postId,
        author_id: currentUser!.id,
        content: commentContent.trim(),
        is_anonymous: isAnonymousComment,
      });
      if (error) throw error;
      setCommentContent("");
      setIsAnonymousComment(false);
      refetchComments();
      toast.success("Comentário adicionado!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoadingComment(false);
    }
  };

  const handlePinPost = async () => {
    await supabase.from("forum_posts").update({ is_pinned: !post?.is_pinned }).eq("id", postId);
    queryClient.invalidateQueries({ queryKey: ["forum-post", postId] });
    toast.success(post?.is_pinned ? "Post desafixado" : "Post fixado!");
  };

  const handleHidePost = async () => {
    await supabase.from("forum_posts").update({ is_hidden: true }).eq("id", postId);
    toast.success("Post ocultado");
    onBack();
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("forum_comments").delete().eq("id", commentId);
    refetchComments();
    toast.success("Comentário removido");
  };

  if (!post) return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Post */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {post.is_pinned && <Pin className="h-4 w-4 text-primary" />}
            <Badge variant="secondary">
              {post.forum_categories?.icon} {post.forum_categories?.name}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {getAuthorName(post.author_id, post.is_anonymous)} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePinPost}>
                  <Pin className="h-4 w-4 mr-2" />
                  {post.is_pinned ? "Desafixar" : "Fixar post"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHidePost} className="text-destructive">
                  <EyeOffIcon className="h-4 w-4 mr-2" />
                  Ocultar post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">{post.title}</h2>
        <p className="text-foreground/80 whitespace-pre-wrap">{post.content}</p>

        {post.image_url && (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
          </div>
        )}

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleLike}
            className={cn("gap-2", userHasLiked && "text-red-500")}
          >
            <Heart className={cn("h-4 w-4", userHasLiked && "fill-current")} />
            {reactions.length}
          </Button>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {comments.length} comentário{comments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Comentários</h3>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum comentário ainda. Seja a primeira!</p>
        ) : (
          comments.map((comment: any) => (
            <div key={comment.id} className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {getAuthorName(comment.author_id, comment.is_anonymous)} · {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                {(isAdmin || comment.author_id === currentUser?.id) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add comment */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <Textarea
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={3}
          maxLength={2000}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="anon-comment"
              checked={isAnonymousComment}
              onCheckedChange={setIsAnonymousComment}
            />
            <Label htmlFor="anon-comment" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
              <EyeOff className="h-3 w-3" /> Anônimo
            </Label>
          </div>
          <Button onClick={handleAddComment} disabled={loadingComment || !commentContent.trim()} size="sm">
            {loadingComment && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
