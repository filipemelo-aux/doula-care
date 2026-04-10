import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    // 1. Find all active subscriptions that have expired
    const { data: expired, error: expError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_id")
      .eq("status", "active")
      .lt("current_period_end", now);

    if (expError) {
      console.error("Error fetching expired subscriptions:", expError);
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expired || expired.length === 0) {
      console.log("No expired subscriptions found");
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expired.length} expired subscriptions`);

    let processed = 0;

    for (const sub of expired) {
      // 2. Mark subscription as canceled
      const { error: cancelError } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", sub.id);

      if (cancelError) {
        console.error(`Error canceling subscription ${sub.id}:`, cancelError);
        continue;
      }

      // 3. Find user's organization and downgrade to free
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", sub.user_id)
        .single();

      if (profile?.organization_id) {
        const { error: orgError } = await supabase
          .from("organizations")
          .update({
            plan: "free",
            next_billing_date: null,
          })
          .eq("id", profile.organization_id);

        if (orgError) {
          console.error(`Error downgrading org ${profile.organization_id}:`, orgError);
        } else {
          console.log(`Org ${profile.organization_id} downgraded to free (user: ${sub.user_id})`);

          // 4. Create notification for the organization
          await supabase.from("org_notifications").insert({
            organization_id: profile.organization_id,
            title: "Plano expirado",
            message: "Seu plano expirou. Regularize o pagamento para continuar utilizando os recursos premium.",
            type: "billing",
          });
        }
      }

      processed++;
    }

    console.log(`Processed ${processed} expired subscriptions`);

    return new Response(
      JSON.stringify({ ok: true, processed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-subscription-expiry error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
