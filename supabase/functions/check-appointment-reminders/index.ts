import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushSubscription,
  type PushMessage,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@^1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find appointments needing 24h reminder (between 23h and 25h from now, not yet sent)
    const { data: remind24h } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, client_id, clients(full_name, user_id)")
      .eq("reminder_24h_sent", false)
      .gte("scheduled_at", new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString());

    // Find appointments needing 1h reminder (between 30min and 1.5h from now, not yet sent)
    const { data: remind1h } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, client_id, clients(full_name, user_id)")
      .eq("reminder_1h_sent", false)
      .gte("scheduled_at", new Date(now.getTime() + 30 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 90 * 60 * 1000).toISOString());

    const vapid: VapidKeys = {
      subject: "mailto:contato@papodedoula.com",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    let sent = 0;
    const expiredEndpoints: string[] = [];

    const sendPush = async (userIds: string[], title: string, body: string, url: string, tag: string) => {
      if (userIds.length === 0) return;

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", userIds);

      if (!subscriptions || subscriptions.length === 0) return;

      for (const sub of subscriptions) {
        try {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };

          const pushMessage: PushMessage = {
            data: JSON.stringify({
              title,
              body,
              icon: "/pwa-icon-192.png",
              badge: "/pwa-icon-192.png",
              url,
              tag,
              type: "appointment_reminder",
              priority: "normal",
              require_interaction: false,
            }),
            options: { ttl: 3600, urgency: "normal" },
          };

          const payload = await buildPushPayload(pushMessage, pushSubscription, vapid);
          const response = await fetch(sub.endpoint, payload);

          if (response.ok) {
            sent++;
          } else if (response.status === 410 || response.status === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        } catch (err) {
          console.error(`Push error for ${sub.endpoint}:`, err);
        }
      }
    };

    // Process 24h reminders
    if (remind24h && remind24h.length > 0) {
      for (const apt of remind24h) {
        const client = apt.clients as any;
        const scheduledDate = new Date(apt.scheduled_at);
        const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // Notify the client
        if (client?.user_id) {
          await sendPush(
            [client.user_id],
            "📅 Lembrete de Consulta",
            `Sua consulta "${apt.title}" é amanhã às ${timeStr}`,
            "/gestante",
            `apt-24h-${apt.id}`
          );
        }

        // Notify admins
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "moderator"]);

        if (adminRoles && adminRoles.length > 0) {
          await sendPush(
            adminRoles.map((r) => r.user_id),
            "📅 Consulta Amanhã",
            `"${apt.title}" com ${client?.full_name || "cliente"} às ${timeStr}`,
            "/agenda",
            `apt-admin-24h-${apt.id}`
          );
        }

        // Mark as sent
        await supabase.from("appointments").update({ reminder_24h_sent: true }).eq("id", apt.id);
      }
    }

    // Process 1h reminders
    if (remind1h && remind1h.length > 0) {
      for (const apt of remind1h) {
        const client = apt.clients as any;
        const scheduledDate = new Date(apt.scheduled_at);
        const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        if (client?.user_id) {
          await sendPush(
            [client.user_id],
            "⏰ Consulta em 1 hora!",
            `"${apt.title}" às ${timeStr}`,
            "/gestante",
            `apt-1h-${apt.id}`
          );
        }

        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "moderator"]);

        if (adminRoles && adminRoles.length > 0) {
          await sendPush(
            adminRoles.map((r) => r.user_id),
            "⏰ Consulta em 1 hora!",
            `"${apt.title}" com ${client?.full_name || "cliente"} às ${timeStr}`,
            "/agenda",
            `apt-admin-1h-${apt.id}`
          );
        }

        await supabase.from("appointments").update({ reminder_1h_sent: true }).eq("id", apt.id);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({
        sent,
        reminders_24h: remind24h?.length || 0,
        reminders_1h: remind1h?.length || 0,
        expired_removed: expiredEndpoints.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
