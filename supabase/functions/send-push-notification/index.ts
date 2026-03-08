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

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_type: string | null;
  created_at?: string;
  updated_at?: string;
};

const getSubscriptionTimestamp = (sub: SubscriptionRow) =>
  new Date(sub.updated_at ?? sub.created_at ?? 0).getTime();

const isAndroidSubscription = (sub: SubscriptionRow) => {
  const type = (sub.device_type ?? "").toLowerCase();
  return type === "android" || type === "android_browser" || type === "android_twa";
};

function reduceSubscriptionsForDelivery(rawSubscriptions: SubscriptionRow[]) {
  // 1) Keep only newest row per endpoint
  const newestByEndpoint = new Map<string, SubscriptionRow>();
  for (const sub of rawSubscriptions) {
    const existing = newestByEndpoint.get(sub.endpoint);
    if (!existing || getSubscriptionTimestamp(sub) > getSubscriptionTimestamp(existing)) {
      newestByEndpoint.set(sub.endpoint, sub);
    }
  }

  // 2) Group by user and collapse Android duplicates to avoid Chrome + native double alerts
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const sub of newestByEndpoint.values()) {
    const current = byUser.get(sub.user_id) ?? [];
    current.push(sub);
    byUser.set(sub.user_id, current);
  }

  const deliverable: SubscriptionRow[] = [];
  const staleEndpoints = new Set<string>();

  for (const userSubs of byUser.values()) {
    const sorted = [...userSubs].sort(
      (a, b) => getSubscriptionTimestamp(b) - getSubscriptionTimestamp(a)
    );

    const twaSubs = sorted.filter((sub) => sub.device_type === "android_twa");
    if (twaSubs.length > 0) {
      const [latestTwa, ...olderTwa] = twaSubs;
      deliverable.push(latestTwa);
      olderTwa.forEach((sub) => staleEndpoints.add(sub.endpoint));

      sorted
        .filter((sub) => sub.device_type === "android" || sub.device_type === "android_browser")
        .forEach((sub) => staleEndpoints.add(sub.endpoint));

      sorted
        .filter((sub) => !isAndroidSubscription(sub))
        .forEach((sub) => deliverable.push(sub));
      continue;
    }

    const androidSubs = sorted.filter((sub) => isAndroidSubscription(sub));
    if (androidSubs.length > 0) {
      const [latestAndroid, ...olderAndroid] = androidSubs;
      deliverable.push(latestAndroid);
      olderAndroid.forEach((sub) => staleEndpoints.add(sub.endpoint));
    }

    sorted
      .filter((sub) => !isAndroidSubscription(sub))
      .forEach((sub) => deliverable.push(sub));
  }

  return { deliverable, staleEndpoints: [...staleEndpoints] };
}

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

    // If we want to send to admin users - SCOPED TO CALLER'S ORG
    if (body.send_to_admins) {
      // Get caller's org
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const callerOrgId = callerProfile?.organization_id;

      if (callerOrgId) {
        // Get admin/moderator users in the SAME org
        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("organization_id", callerOrgId);

        if (orgProfiles) {
          const orgUserIds = orgProfiles.map(p => p.user_id);
          
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "moderator"])
            .in("user_id", orgUserIds);

          if (adminRoles) {
            targetUserIds = [
              ...targetUserIds,
              ...adminRoles.map((r) => r.user_id),
            ];
          }
        }
      }
    }

    // De-duplicate
    targetUserIds = [...new Set(targetUserIds)];
    console.log("[push] targetUserIds:", targetUserIds.length, targetUserIds);

    if (targetUserIds.length === 0) {
      console.log("[push] No target users, returning early");
      return new Response(
        JSON.stringify({ sent: 0, message: "No target users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check org plan allows push notifications (only for non-admin senders)
    // Get caller's org plan
    const { data: callerProfileForPlan } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerProfileForPlan?.organization_id) {
      const { data: orgPlanData } = await supabase
        .from("organizations")
        .select("plan")
        .eq("id", callerProfileForPlan.organization_id)
        .single();

      console.log("[push] Org plan:", orgPlanData?.plan);
      if (orgPlanData?.plan === "free") {
        console.log("[push] Blocked: free plan");
        return new Response(
          JSON.stringify({ error: "Push notifications not available on Free plan" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subError) {
      throw subError;
    }

    console.log("[push] Subscriptions found:", subscriptions?.length ?? 0);
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[push] No subscriptions, returning early");
      return new Response(
        JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      deliverable: subscriptionsToSend,
      staleEndpoints,
    } = reduceSubscriptionsForDelivery(subscriptions as SubscriptionRow[]);

    if (subscriptionsToSend.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active push subscriptions found" }),
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

    for (const sub of subscriptionsToSend) {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const isCritica = priority === "critica";

        const notifType = type || "general";
        const typeIconMap: Record<string, string> = {
          new_message: "/notif-icon-messages.png",
          new_contraction: "/notif-icon-contractions.png",
          labor_started: "/notif-icon-labor.png",
          appointment_reminder: "/notif-icon-appointments.png",
          budget_response: "/notif-icon-services.png",
          payment_received: "/notif-icon-payment.png",
          new_diary: "/notif-icon-diary.png",
          general: "/badge-mono-v2.png",
        };
        const notifIcon = typeIconMap[notifType] || "/badge-mono-v2.png";

        const pushMessage: PushMessage = {
          data: JSON.stringify({
            title,
            body: message,
            icon: notifIcon,
            badge: "/badge-status-v3.png?v=3",
            url: url || "/",
            tag: tag || notifType || "default",
            type: notifType,
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

    // Clean up expired + stale subscriptions
    const endpointsToRemove = [...new Set([...expiredEndpoints, ...staleEndpoints])];
    if (endpointsToRemove.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", endpointsToRemove);
    }

    console.log(`[push] Result: sent=${sent}, failed=${failed}, expired=${expiredEndpoints.length}, stale=${staleEndpoints.length}`);
    return new Response(
      JSON.stringify({
        sent,
        failed,
        expired_removed: expiredEndpoints.length,
        stale_removed: staleEndpoints.length,
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
