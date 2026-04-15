import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron job — checks org_promotions for expired trials.
 *
 * 1. Finds trials with status "trial_active" whose trial_ends_at < now
 * 2. Skips lifetime_premium promotions (they get lifetime_active, not downgraded)
 * 3. Downgrades org plan to "free"
 * 4. Updates promo status to "expired"
 * 5. Notifies the doula and sends push notification
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nowISO = new Date().toISOString();
    let processed = 0;

    // Find expired trials (excluding lifetime_premium which should reveal surprise)
    const { data: expiredTrials, error } = await supabase
      .from("org_promotions")
      .select("id, organization_id, promotion_type, trial_ends_at")
      .eq("status", "trial_active")
      .neq("promotion_type", "lifetime_premium")
      .lt("trial_ends_at", nowISO);

    if (error) {
      console.error("Error fetching expired trials:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch expired trials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log("No expired trials found");
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredTrials.length} expired trial(s)`);

    for (const trial of expiredTrials) {
      // Check if org has an active Stripe subscription (don't downgrade if they subscribed)
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", trial.organization_id)
        .limit(1)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: activeSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (activeSub) {
          console.log(`Org ${trial.organization_id} has active subscription, marking trial completed`);
          await supabase
            .from("org_promotions")
            .update({ status: "completed" })
            .eq("id", trial.id);
          continue;
        }
      }

      // Downgrade org to free
      const { error: orgError } = await supabase
        .from("organizations")
        .update({ plan: "free" })
        .eq("id", trial.organization_id);

      if (orgError) {
        console.error(`Error downgrading org ${trial.organization_id}:`, orgError);
        continue;
      }

      // Mark promotion as expired
      const { error: promoError } = await supabase
        .from("org_promotions")
        .update({ status: "expired" })
        .eq("id", trial.id);

      if (promoError) {
        console.error(`Error updating promo ${trial.id}:`, promoError);
      }

      // Notify the doula
      await supabase.from("org_notifications").insert({
        organization_id: trial.organization_id,
        title: "⏰ Período de teste expirado",
        message:
          "Seu período de teste Premium terminou. Seu plano foi alterado para Free. Assine um plano para continuar com todos os recursos.",
        type: "billing",
      });

      // Push notification (best-effort)
      if (profile?.user_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: profile.user_id,
              title: "Período de teste expirado",
              message:
                "Seu trial Premium terminou. Assine um plano para continuar usando todos os recursos.",
            }),
          });
        } catch (_) {
          // Best-effort
        }
      }

      console.log(`Org ${trial.organization_id} downgraded to free (trial expired)`);
      processed++;
    }

    console.log(`Done: ${processed} trial(s) expired and downgraded`);

    return new Response(
      JSON.stringify({ ok: true, processed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-trial-expiry error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
