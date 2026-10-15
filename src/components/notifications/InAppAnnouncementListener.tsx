import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InAppAnnouncementDialog } from "./InAppAnnouncementDialog";
import { detectNotificationDevice } from "@/lib/accessPlatform";

export function InAppAnnouncementListener({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const device = detectNotificationDevice();
  const queryKey = ["in-app-announcement", userId, device];
  const { data: announcement } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("in_app_announcements")
        .select("id, title, message")
        .eq("user_id", userId).is("read_at", null)
        .or(`target_device.eq.all,target_device.eq.${device}`)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
  });
  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("in_app_announcements")
        .update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId)
        .select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível fechar o aviso. Tente novamente."),
  });

  if (!announcement) return null;
  return <InAppAnnouncementDialog open title={announcement.title} message={announcement.message}
    closing={acknowledge.isPending}
    onClose={() => { if (!acknowledge.isPending) acknowledge.mutate(announcement.id); }} />;
}