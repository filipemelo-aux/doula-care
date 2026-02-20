import { supabase } from "@/integrations/supabase/client";

interface SendPushParams {
  user_ids?: string[];
  client_ids?: string[];
  send_to_admins?: boolean;
  title: string;
  message: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(params: SendPushParams): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: params,
    });
    if (error) {
      console.error("Error sending push notification:", error);
    }
  } catch (err) {
    // Silent fail - push notifications are best-effort
    console.error("Push notification error:", err);
  }
}
