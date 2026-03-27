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
  token_type: string;
  created_at?: string;
  updated_at?: string;
};

const getSubscriptionTimestamp = (sub: SubscriptionRow) =>
  new Date(sub.updated_at ?? sub.created_at ?? 0).getTime();

const isAndroidSubscription = (sub: SubscriptionRow) => {
  const type = (sub.device_type ?? "").toLowerCase();
  return type === "android" || type === "android_browser" || type === "android_twa" || type === "android_capacitor";
};

const isIosSubscription = (sub: SubscriptionRow) => {
  const type = (sub.device_type ?? "").toLowerCase();
  return type === "ios_capacitor" || type === "ios";
};

function reduceSubscriptionsForDelivery(rawSubscriptions: SubscriptionRow[]) {
  const newestByEndpoint = new Map<string, SubscriptionRow>();
  for (const sub of rawSubscriptions) {
    const existing = newestByEndpoint.get(sub.endpoint);
    if (!existing || getSubscriptionTimestamp(sub) > getSubscriptionTimestamp(existing)) {
      newestByEndpoint.set(sub.endpoint, sub);
    }
  }

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

    const capacitorSubs = sorted.filter((sub) => sub.token_type === "fcm");
    const twaSubs = sorted.filter((sub) => sub.device_type === "android_twa");

    if (capacitorSubs.length > 0) {
      const [latestCap, ...olderCap] = capacitorSubs;
      deliverable.push(latestCap);
      olderCap.forEach((sub) => staleEndpoints.add(sub.endpoint));
      sorted
        .filter((sub) => isAndroidSubscription(sub) && sub.token_type !== "fcm")
        .forEach((sub) => staleEndpoints.add(sub.endpoint));
      sorted
        .filter((sub) => !isAndroidSubscription(sub))
        .forEach((sub) => deliverable.push(sub));
      continue;
    }

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

// ─── FCM HTTP v1 API ─────────────────────────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/** Import a PEM private key for signing JWTs */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/** Base64url encode */
function base64url(data: Uint8Array | string): string {
  const str = typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Get an OAuth2 access token for FCM v1 API using a service account */
async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
  );

  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const key = await importPrivateKey(sa.private_key);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signingInput)
  );

  const jwt = `${header}.${payload}.${base64url(signature)}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) {
    console.error("[push] OAuth token error:", tokenBody);
    throw new Error("Failed to get FCM access token");
  }

  cachedAccessToken = {
    token: tokenBody.access_token,
    expiresAt: now + (tokenBody.expires_in || 3600),
  };

  return tokenBody.access_token;
}

/** Send a push notification via FCM HTTP v1 API */
async function sendFcmV1Push(
  fcmToken: string,
  payload: { title: string; body: string; icon?: string; image?: string; url?: string; tag?: string; type?: string; priority?: string; require_interaction?: boolean },
  sa: ServiceAccount
): Promise<{ ok: boolean; status: number; errorMessage?: string }> {
  const accessToken = await getFcmAccessToken(sa);
  const isCritica = payload.priority === "critica";

  const fcmPayload = {
    message: {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: isCritica ? "HIGH" : "NORMAL",
        notification: {
          icon: "ic_stat_notify",
          color: "#c34a1c",
          tag: payload.tag || payload.type || "default",
          click_action: "FCM_PLUGIN_ACTIVITY",
          channel_id: isCritica ? "high_priority" : "default",
          ...(payload.image ? { image: payload.image } : {}),
        },
      },
      apns: {
        headers: {
          "apns-priority": isCritica ? "10" : "5",
          ...(payload.tag ? { "apns-collapse-id": payload.tag } : {}),
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: isCritica ? "default" : "default",
            badge: 1,
            "mutable-content": 1,
            "content-available": 1,
          },
          url: payload.url || "/",
          type: payload.type || "general",
        },
      },
      data: {
        url: payload.url || "/",
        type: payload.type || "general",
        priority: isCritica ? "critica" : "normal",
        tag: payload.tag || payload.type || "default",
        require_interaction: String(payload.require_interaction ?? isCritica),
        ...(payload.image ? { image: payload.image } : {}),
      },
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmPayload),
    }
  );

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`[push] FCM v1 error (${response.status}):`, responseText);
  }

  return { ok: response.ok, status: response.status, errorMessage: response.ok ? undefined : responseText };
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let firebaseServiceAccount: ServiceAccount | null = null;
    if (firebaseServiceAccountJson) {
      try {
        firebaseServiceAccount = JSON.parse(firebaseServiceAccountJson);
      } catch (e) {
        console.error("[push] Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

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
      image,
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
      image?: string;
    } = body;

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          ...clients.map((c) => c.user_id).filter((id): id is string => !!id),
        ];
      }
    }

    if (body.send_to_admins) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const callerOrgId = callerProfile?.organization_id;

      if (callerOrgId) {
        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("organization_id", callerOrgId);

        if (orgProfiles) {
          const orgUserIds = orgProfiles.map((p) => p.user_id);
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "moderator"])
            .in("user_id", orgUserIds);

          if (adminRoles) {
            targetUserIds = [...targetUserIds, ...adminRoles.map((r) => r.user_id)];
          }
        }
      }
    }

    targetUserIds = [...new Set(targetUserIds)];
    console.log("[push] targetUserIds:", targetUserIds.length, targetUserIds);

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No target users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super_admin
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!superAdminRole;

    if (!isSuperAdmin) {
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

        if (orgPlanData?.plan === "free") {
          return new Response(
            JSON.stringify({ error: "Push notifications not available on Free plan" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      console.log("[push] Super admin bypass: skipping plan check");
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subError) throw subError;

    console.log("[push] Subscriptions found:", subscriptions?.length ?? 0);
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { deliverable: subscriptionsToSend, staleEndpoints } =
      reduceSubscriptionsForDelivery(subscriptions as SubscriptionRow[]);

    console.log("[push] Deliverable:", subscriptionsToSend.length, "Stale:", staleEndpoints.length);
    for (const sub of subscriptionsToSend) {
      console.log(`[push]   → ${sub.token_type}/${sub.device_type}: ${sub.endpoint.substring(0, 30)}...`);
    }

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

    const isCritica = priority === "critica";
    const notifType = type || "general";

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptionsToSend) {
      try {
        // ── FCM native token (Capacitor) ──
        if (sub.token_type === "fcm") {
          if (!firebaseServiceAccount) {
            console.error("[push] FIREBASE_SERVICE_ACCOUNT not configured, skipping FCM token");
            failed++;
            continue;
          }

          console.log(`[push] Sending via FCM v1 to ${sub.endpoint.substring(0, 20)}...`);
          const result = await sendFcmV1Push(
            sub.endpoint,
            {
              title,
              body: message,
              icon: "/logo.png",
              image: image || undefined,
              url: url || "/",
              tag: tag || notifType,
              type: notifType,
              priority: isCritica ? "critica" : "normal",
              require_interaction: require_interaction ?? isCritica,
            },
            firebaseServiceAccount
          );

          if (result.ok) {
            sent++;
            console.log("[push] FCM v1 sent successfully");
          } else if (result.status === 404 || result.status === 410) {
            // Token expired/invalid
            expiredEndpoints.push(sub.endpoint);
            failed++;
          } else {
            console.error(`[push] FCM v1 failed: ${result.status}`);
            failed++;
          }
          continue;
        }

        // ── Web Push (VAPID) ──
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const pushMessage: PushMessage = {
          data: JSON.stringify({
            title,
            body: message,
            icon: "/logo.png",
            badge: "/badge-mono-v2.png",
            image: image || undefined,
            url: url || "/",
            tag: tag || notifType || "default",
            type: notifType,
            priority: isCritica ? "critica" : "normal",
            require_interaction: require_interaction ?? isCritica,
          }),
          options: {
            ttl: isCritica ? 86400 : 3600,
            urgency: isCritica ? "high" : "normal",
          },
        };

        const payload = await buildPushPayload(pushMessage, pushSubscription, vapid);
        const response = await fetch(sub.endpoint, payload);

        if (response.ok) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          const text = await response.text();
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${text}`);
          failed++;
        }
      } catch (err) {
        console.error(`Error sending push to ${sub.endpoint}:`, err);
        failed++;
      }
    }

    // Clean up expired + stale
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
