import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadMessageAttachment(
  file: File,
  userId: string
): Promise<{ url: string; type: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Arquivo muito grande. Máximo: 5MB");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("message-attachments")
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from("message-attachments")
    .getPublicUrl(path);

  const isImage = file.type.startsWith("image/");
  return { url: data.publicUrl, type: isImage ? "image" : "file" };
}

export function compressImageIfNeeded(file: File): Promise<File> {
  return new Promise((resolve) => {
    // If under 1MB or not an image, return as-is
    if (file.size <= 1024 * 1024 || !file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}
