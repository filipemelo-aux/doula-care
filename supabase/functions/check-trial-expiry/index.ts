import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron job — checks org_promotions for expired trials.
 *
 * Phase A: Orgs with trial_active that already have an active Stripe subscription
 *          → mark promo as "completed" (no downgrade needed)
 *
 * Phase B: Expired trials (trial_ends_at < now) without active subscription
 *          → downgrade org to free, mark as "expired", notify doula
 *
 * Skips lifetime_active promotions (permanent access).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let completedCount = 0;
    let expiredCount = 0;

    // Fetch ALL trial_active promotions
    const { data: activeTrials, error } = await supabase
      .from("org_promotions")
      .select("id, organization_id, promotion_type, trial_ends_at")
      .eq("status", "trial_active");

    if (error) {
      console.error("Error fetching active trials:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch trials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!activeTrials || activeTrials.length === 0) {
      console.log("No active trials found");
      return new Response(
        JSON.stringify({ ok: true, completed: 0, expired: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${activeTrials.length} active trial(s) to check`);

    for (const trial of activeTrials) {
      // Get org's admin user
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", trial.organization_id)
        .limit(1)
        .maybeSingle();

      // Check if org has active Stripe subscription
      let hasActiveSub = false;
      if (profile?.user_id) {
        const { data: activeSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        hasActiveSub = !!activeSub;
      }

      // Phase A: Has active subscription → mark trial completed
      if (hasActiveSub) {
        console.log(`Org ${trial.organization_id} has active subscription, marking trial completed`);
        await supabase
          .from("org_promotions")
          .update({ status: "completed", chosen_plan: null, bonus_choice: null, bonus_chosen_at: null, bonus_started_at: null, bonus_ends_at: null })
          .eq("id", trial.id);
        completedCount++;
        continue;
      }

      // Phase B: Trial expired without subscription → downgrade
      const isExpired = trial.trial_ends_at && new Date(trial.trial_ends_at) < new Date();
      if (!isExpired) {
        console.log(`Org ${trial.organization_id} trial still active, skipping`);
        continue;
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
      await supabase
        .from("org_promotions")
        .update({ status: "expired", chosen_plan: null, bonus_choice: null, bonus_chosen_at: null, bonus_started_at: null, bonus_ends_at: null })
        .eq("id", trial.id);

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
              message: "Seu trial Premium terminou. Assine um plano para continuar usando todos os recursos.",
            }),
          });
        } catch (_) {
          // Best-effort
        }
      }

      console.log(`Org ${trial.organization_id} downgraded to free (trial expired)`);
      expiredCount++;
    }

    console.log(`Done: ${completedCount} completed (subscribed), ${expiredCount} expired and downgraded`);

    return new Response(
      JSON.stringify({ ok: true, completed: completedCount, expired: expiredCount }),
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