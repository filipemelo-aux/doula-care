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
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is authenticated (admin or system)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      user_ids,
      client_ids,
      title,
      message,
      url,
      tag,
      type,
      priority,
      require_interaction,
    }: {
      user_ids?: string[];
      client_ids?: string[];
      title: string;
      message: string;
      url?: string;
      tag?: string;
      type?: string;
      priority?: string;
      require_interaction?: boolean;
    } = body;

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Resolve user_ids from client_ids if provided
    let targetUserIds: string[] = user_ids || [];

    if (client_ids && client_ids.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("user_id")
        .in("id", client_ids)
        .not("user_id", "is", null);

      if (clients) {
        targetUserIds = [
          ...targetUserIds,
          ...clients
            .map((c) => c.user_id)
            .filter((id): id is string => !!id),
        ];
      }
    }

    // If we want to send to admin users (e.g., for gestante events)
    if (body.send_to_admins) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"]);

      if (adminRoles) {
        targetUserIds = [
          ...targetUserIds,
          ...adminRoles.map((r) => r.user_id),
        ];
      }
    }

    // De-duplicate
    targetUserIds = [...new Set(targetUserIds)];

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No target users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapid: VapidKeys = {
      subject: "mailto:contato@papodedoula.com",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const isCritica = priority === "critica";

        const pushMessage: PushMessage = {
          data: JSON.stringify({
            title,
            body: message,
            icon: "/pwa-icon-192.png",
            badge: "/pwa-icon-192.png",
            url: url || "/",
            tag: tag || type || "default",
            type: type || "general",
            priority: isCritica ? "critica" : "normal",
            require_interaction: require_interaction ?? isCritica,
          }),
          options: {
            ttl: isCritica ? 86400 : 3600, // 24h for critical, 1h for normal
            urgency: isCritica ? "high" : "normal",
          },
        };

        const payload = await buildPushPayload(
          pushMessage,
          pushSubscription,
          vapid
        );

        const response = await fetch(sub.endpoint, payload);

        if (response.ok) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, mark for removal
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          console.error(
            `Push failed for ${sub.endpoint}: ${response.status} ${await response.text()}`
          );
          failed++;
        }
      } catch (err) {
        console.error(`Error sending push to ${sub.endpoint}:`, err);
        failed++;
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        expired_removed: expiredEndpoints.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
