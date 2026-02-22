import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WelcomeNameDialogProps {
  fullName: string;
  userId: string;
  onComplete: (preferredName: string) => void;
}

export function WelcomeNameDialog({ fullName, userId, onComplete }: WelcomeNameDialogProps) {
  const firstName = fullName?.split(" ")[0] || "";
  const [name, setName] = useState(firstName);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Por favor, preencha como gostaria de ser chamada");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ preferred_name: trimmed })
        .eq("user_id", userId);

      if (error) throw error;
      onComplete(trimmed);
    } catch (error) {
      console.error("Error saving preferred name:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-pink-50 via-primary/5 to-accent/10 border border-primary/20 shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        {/* Decorative header */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-300 to-primary flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <Heart className="h-5 w-5 text-pink-500 absolute -top-1 -right-1 animate-bounce" />
          </div>
        </div>

        {/* Welcome text */}
        <div className="text-center space-y-2">
          <h2 className="font-display font-bold text-2xl text-foreground">
            Bem-vinda! 💕
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Olá <span className="font-semibold text-primary">{firstName}</span>, que alegria ter você aqui!
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Como você gostaria de ser chamada?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome ou apelido"
            className="text-center text-lg font-medium border-primary/30 focus:border-primary bg-background/80"
            autoFocus
          />
          <Button
            type="submit"
            className="w-full rounded-xl h-12 text-base font-semibold"
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Continuar 💛"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
