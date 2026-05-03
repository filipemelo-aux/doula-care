// Google Play Real-time Developer Notifications (RTDN) receiver.
// Pub/Sub posts a message with base64-encoded JSON. This handler decodes it
// and updates the subscription state. TODO(prod): verify Pub/Sub OIDC token
// from Authorization header and call purchases.subscriptionsv2.get for the
// authoritative state before persisting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const messageData: string | undefined = body?.message?.data;
    if (!messageData) return new Response("Missing data", { status: 400 });

    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(messageData), (c) => c.charCodeAt(0))
      )
    );

    const subNotif = decoded.subscriptionNotification;
    if (!subNotif) {
      // ignore test/voided notifications
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const purchaseToken: string = subNotif.purchaseToken;
    const productId: string = subNotif.subscriptionId;
    const notifType: number = subNotif.notificationType;

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: sub } = await svc
      .from("subscriptions")
      .select("id, user_id")
      .eq("purchase_token", purchaseToken)
      .maybeSingle();

    if (sub) {
      // https://developer.android.com/google/play/billing/rtdn-reference#sub
      let newStatus: string | null = null;
      switch (notifType) {
        case 1: // RECOVERED
        case 2: // RENEWED
        case 4: // PURCHASED
        case 7: // RESTARTED
          newStatus = "active";
          break;
        case 3: // CANCELED
          newStatus = "canceled";
          break;
        case 5: // ON_HOLD
        case 6: // IN_GRACE_PERIOD
          newStatus = "grace_period";
          break;
        case 12: // REVOKED
        case 13: // EXPIRED
          newStatus = "expired";
          break;
      }

      if (newStatus) {
        await svc
          .from("subscriptions")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", sub.id);

        if (newStatus === "expired" || newStatus === "canceled") {
          const { data: profile } = await svc
            .from("profiles")
            .select("organization_id")
            .eq("user_id", sub.user_id)
            .maybeSingle();
          if (profile?.organization_id) {
            await svc
              .from("organizations")
              .update({ plan: "free", updated_at: new Date().toISOString() })
              .eq("id", profile.organization_id);
          }
        }
      }

      await svc.from("subscription_events").insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        platform: "android",
        event_type: "rtdn:" + notifType,
        product_id: productId ?? null,
        raw_payload: decoded,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[google-play-webhook]", err);
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
});
