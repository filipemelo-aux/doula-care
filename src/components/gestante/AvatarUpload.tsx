import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  name?: string;
  size?: "sm" | "lg";
}

export function AvatarUpload({ currentUrl, onUploaded, name, size = "lg" }: AvatarUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = size === "lg" ? "w-20 h-20" : "w-12 h-12";
  const iconSize = size === "lg" ? "w-8 h-8" : "w-5 h-5";

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profiles table
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      onUploaded(avatarUrl);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className="relative inline-block">
      <Avatar className={sizeClasses}>
        <AvatarImage src={currentUrl || undefined} alt="Avatar" />
        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
          {initials || <User className={iconSize} />}
        </AvatarFallback>
      </Avatar>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-md border-2 border-background"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
