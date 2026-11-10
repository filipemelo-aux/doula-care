import { syncStoreUser } from '../_shared/storeSync.ts';
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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: sub } = await svc
      .from("subscriptions")
      .select("id, user_id")
      .eq("purchase_token", purchaseToken)
      .maybeSingle();

    if (sub) {
      await syncStoreUser(sub.user_id, 'android');

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
