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
import { Camera, Loader2, Trash2, ImagePlus, Baby, Heart } from "lucide-react";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/gestante/ImageCropDialog";
import { cn } from "@/lib/utils";

interface AdminClientAvatarUploadProps {
  clientId: string;
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
  isPuerpera?: boolean;
  className?: string;
}

export function AdminClientAvatarUpload({
  clientId,
  currentUrl,
  onUploaded,
  isPuerpera,
  className,
}: AdminClientAvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => toast.error("Erro ao ler a imagem");
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const invokeFn = async (form: FormData) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const url = `https://gjnvxzsforfrxjanxqnq.supabase.co/functions/v1/admin-upload-client-avatar`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Falha no upload");
    return json as { avatar_url: string | null };
  };

  const handleCroppedUpload = async (blob: Blob) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("client_id", clientId);
      form.append("action", "upload");
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const { avatar_url } = await invokeFn(form);
      onUploaded(avatar_url);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message || "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("client_id", clientId);
      form.append("action", "remove");
      await invokeFn(form);
      onUploaded(null);
      toast.success("Foto removida!");
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message || "Erro ao remover");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className="w-16 h-16 shadow-md ring-2 ring-background">
        <AvatarImage src={currentUrl || undefined} className="object-cover" />
        <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25">
          {isPuerpera ? (
            <Heart className="w-6 h-6 text-primary" />
          ) : (
            <Baby className="w-6 h-6 text-primary" />
          )}
        </AvatarFallback>
      </Avatar>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-md border border-background"
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 z-[100]">
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

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />

      <ImageCropDialog
        open={!!cropSrc}
        onOpenChange={(open) => { if (!open) setCropSrc(null); }}
        imageSrc={cropSrc || ""}
        onCropComplete={handleCroppedUpload}
      />
    </div>
  );
}
