// Apple App Store Server Notifications V2 receiver.
// Currently parses signedPayload (without JWS signature verification) and
// updates the subscription state. TODO(prod): verify Apple JWS signature
// chain using x5c headers + Apple Root CA before trusting events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    // Apple sends { signedPayload: "<JWS>" }
    const signedPayload: string | undefined = body.signedPayload;
    if (!signedPayload) return new Response("Missing payload", { status: 400 });

    // Decode JWS payload (base64url middle segment) — without verifying signature.
    const segments = signedPayload.split(".");
    if (segments.length !== 3) return new Response("Invalid JWS", { status: 400 });
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(segments[1].replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0)
        )
      )
    );

    const notificationType: string = payload.notificationType ?? "";
    const subtype: string | undefined = payload.subtype;
    const data = payload.data ?? {};
    const transactionInfo = data.signedTransactionInfo
      ? decodeJwsPayload(data.signedTransactionInfo)
      : null;
    const renewalInfo = data.signedRenewalInfo
      ? decodeJwsPayload(data.signedRenewalInfo)
      : null;

    const originalTransactionId =
      transactionInfo?.originalTransactionId ?? renewalInfo?.originalTransactionId;
    const productId = transactionInfo?.productId ?? renewalInfo?.productId;

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    if (originalTransactionId) {
      const { data: sub } = await svc
        .from("subscriptions")
        .select("id, user_id")
        .eq("original_transaction_id", originalTransactionId)
        .maybeSingle();

      if (sub) {
        let newStatus: string | null = null;
        let newPeriodEnd: string | null = transactionInfo?.expiresDate
          ? new Date(transactionInfo.expiresDate).toISOString()
          : null;

        switch (notificationType) {
          case "DID_RENEW":
          case "SUBSCRIBED":
            newStatus = "active";
            break;
          case "EXPIRED":
            newStatus = "expired";
            break;
          case "DID_FAIL_TO_RENEW":
            newStatus = subtype === "GRACE_PERIOD" ? "grace_period" : "billing_issue";
            break;
          case "REFUND":
          case "REVOKE":
          case "DID_CHANGE_RENEWAL_STATUS":
            if (subtype === "AUTO_RENEW_DISABLED") newStatus = "canceled";
            break;
        }

        if (newStatus) {
          const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
          if (newPeriodEnd) updates.current_period_end = newPeriodEnd;
          await svc.from("subscriptions").update(updates).eq("id", sub.id);

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
          platform: "ios",
          event_type: notificationType + (subtype ? ":" + subtype : ""),
          product_id: productId ?? null,
          raw_payload: payload,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[apple-webhook]", err);
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
});

function decodeJwsPayload(jws: string): any {
  try {
    const seg = jws.split(".")[1];
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(seg.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0)
        )
      )
    );
  } catch {
    return null;
  }
}
