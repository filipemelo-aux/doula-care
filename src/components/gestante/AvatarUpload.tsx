import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, Loader2, User, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
  userId?: string;
  name?: string;
  size?: "sm" | "lg";
}

export function AvatarUpload({ currentUrl, onUploaded, userId, name, size = "lg" }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = size === "lg" ? "w-20 h-20" : "w-12 h-12";
  const iconSize = size === "lg" ? "w-8 h-8" : "w-5 h-5";

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

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
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      onUploaded(avatarUrl);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      // Reset inputs so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      // Try to remove from storage (ignore errors if file doesn't exist)
      await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`, `${userId}/avatar.jpeg`]);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);

      if (error) throw error;

      onUploaded(null);
      toast.success("Foto removida!");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Erro ao remover foto");
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
        <AvatarImage src={currentUrl || undefined} alt="Avatar" className="object-cover" />
        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
          {initials || <User className={iconSize} />}
        </AvatarFallback>
      </Avatar>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-md border-2 border-background"
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4 mr-2" />
            Escolher foto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
            <Camera className="h-4 w-4 mr-2" />
            Tirar foto
          </DropdownMenuItem>
          {currentUrl && (
            <DropdownMenuItem onClick={handleRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remover foto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
