import { supabase } from "@/integrations/supabase/client";

export type PushNotificationType =
  | "labor_started"
  | "new_contraction"
  | "new_diary"
  | "new_message"
  | "budget_response"
  | "payment_received"
  | "appointment_reminder"
  | "general";

export type PushPriority = "normal" | "critica";

const NOTIFICATION_ROUTES: Record<PushNotificationType, string> = {
  labor_started: "/admin",
  new_contraction: "/admin",
  new_diary: "/admin",
  new_message: "/gestante/mensagens",
  budget_response: "/gestante/mensagens",
  payment_received: "/financeiro",
  appointment_reminder: "/agenda",
  general: "/",
};

// Types that are always critical
const CRITICAL_TYPES: PushNotificationType[] = [
  "labor_started",
  "new_contraction",
];

interface SendPushParams {
  user_ids?: string[];
  client_ids?: string[];
  send_to_admins?: boolean;
  title: string;
  message: string;
  url?: string;
  tag?: string;
  type?: PushNotificationType;
  priority?: PushPriority;
  require_interaction?: boolean;
}

export function getRouteForNotificationType(type: PushNotificationType): string {
  return NOTIFICATION_ROUTES[type] || "/";
}

export async function sendPushNotification(params: SendPushParams): Promise<void> {
  const isCritical =
    params.priority === "critica" ||
    (params.type && CRITICAL_TYPES.includes(params.type));

  const resolvedParams = {
    ...params,
    url: params.url || (params.type ? getRouteForNotificationType(params.type) : "/"),
    priority: isCritical ? "critica" : "normal",
    require_interaction: params.require_interaction ?? isCritical,
  };

  try {
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: resolvedParams,
    });
    if (error) {
      console.error("Error sending push notification:", error);
    }
  } catch (err) {
    console.error("Push notification error:", err);
  }
}
