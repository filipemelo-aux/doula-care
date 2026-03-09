import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MessageSquare, Pin, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ForumNewPostDialog from "@/components/forum/ForumNewPostDialog";
import ForumPostDetail from "@/components/forum/ForumPostDetail";

export default function Forum() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  // Fetch author names for non-anonymous posts
  const authorIds = posts.filter(p => !p.is_anonymous).map(p => p.author_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["forum-profiles", authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return [];
      // Try profiles first
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      
      // Also check clients
      const { data: clientData } = await supabase
        .from("clients")
        .select("user_id, full_name, preferred_name")
        .in("user_id", authorIds);

      const map: Record<string, string> = {};
      profileData?.forEach(p => {
        if (p.full_name) map[p.user_id] = p.full_name;
      });
      clientData?.forEach(c => {
        if (c.user_id) map[c.user_id] = c.preferred_name || c.full_name;
      });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const getAuthorName = (post: any) => {
    if (post.is_anonymous) return "Anônima";
    const profileMap = profiles as Record<string, string>;
    return profileMap[post.author_id] || "Usuária";
  };

  if (selectedPostId) {
    return (
      <ForumPostDetail
        postId={selectedPostId}
        onBack={() => {
          setSelectedPostId(null);
          refetchPosts();
        }}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Comunidade</h1>
          <p className="text-sm text-muted-foreground">Compartilhe experiências e tire dúvidas</p>
        </div>
        <Button onClick={() => setShowNewPost(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Post</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na comunidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="shrink-0"
        >
          Todos
        </Button>
        {categories.map((cat: any) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className="shrink-0"
          >
            {cat.icon} {cat.name}
          </Button>
        ))}
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum post encontrado</p>
            <p className="text-sm">Seja a primeira a compartilhar!</p>
          </div>
        ) : (
          posts.map((post: any) => (
            <button
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {post.is_pinned && (
                      <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {post.forum_categories?.icon} {post.forum_categories?.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getAuthorName(post)} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground line-clamp-1">{post.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
                  {post.image_url && (
                    <div className="mt-2 h-32 w-full rounded-lg overflow-hidden bg-muted">
                      <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {post.forum_comments?.[0]?.count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {post.forum_reactions?.[0]?.count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <ForumNewPostDialog
        open={showNewPost}
        onOpenChange={setShowNewPost}
        categories={categories}
        onCreated={() => {
          setShowNewPost(false);
          refetchPosts();
        }}
      />
    </div>
  );
}
