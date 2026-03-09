import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EyeOff, Loader2 } from "lucide-react";

interface ForumNewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  onCreated: () => void;
}

export default function ForumNewPostDialog({ open, onOpenChange, categories, onCreated }: ForumNewPostDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !categoryId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("forum_posts").insert({
        title: title.trim(),
        content: content.trim(),
        category_id: categoryId,
        author_id: user.id,
        is_anonymous: isAnonymous,
      });

      if (error) throw error;

      toast.success("Post publicado!");
      setTitle("");
      setContent("");
      setCategoryId("");
      setIsAnonymous(false);
      onCreated();
    } catch (err: any) {
      toast.error("Erro ao publicar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Categoria *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
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
          </div>

          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do post"
              maxLength={200}
            />
          </div>

          <div>
            <Label>Conteúdo *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Compartilhe sua experiência, dúvida ou dica..."
              rows={5}
              maxLength={5000}
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                Postar anonimamente
              </Label>
              <p className="text-xs text-muted-foreground">Seu nome não será exibido</p>
            </div>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
