import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron job — reacts to subscription state managed by Stripe webhooks.
 *
 * Phase 1: Active subscriptions whose period ended → mark "pending" + notify.
 *          Stripe controls recurrence & billing; we only flag locally.
 *
 * Phase 2: Pending subscriptions past 3-day grace → cancel + block org.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const nowISO = now.toISOString();

    let processedPending = 0;
    let processedBlocked = 0;

    // ── PHASE 1 — Expired active → pending (notify only, no payment generation) ──
    const { data: expired, error: expError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_id, current_period_end")
      .eq("status", "active")
      .lt("current_period_end", nowISO);

    if (expError) {
      console.error("Error fetching expired active subscriptions:", expError);
    }

    if (expired && expired.length > 0) {
      console.log(`Phase 1: ${expired.length} active subscriptions expired`);

      for (const sub of expired) {
        // Mark as pending — Stripe will send invoice.payment_succeeded when renewed
        const { error: pendingError } = await supabase
          .from("subscriptions")
          .update({ status: "pending" })
          .eq("id", sub.id);

        if (pendingError) {
          console.error(`Error setting subscription ${sub.id} to pending:`, pendingError);
          continue;
        }

        // Notify user
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", sub.user_id)
          .single();

        if (profile?.organization_id) {
          await supabase.from("org_notifications").insert({
            organization_id: profile.organization_id,
            title: "Assinatura vencida",
            message:
              "Sua assinatura venceu. O Stripe tentará renovar automaticamente. Você tem 3 dias de carência.",
            type: "billing",
          });
        }

        // Push notification (best-effort)
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: sub.user_id,
              title: "Assinatura vencida",
              message:
                "Sua assinatura venceu. A renovação será tentada automaticamente.",
            }),
          });
        } catch (_) {
          // Best-effort
        }

        processedPending++;
      }
    }

    // ── PHASE 2 — Pending past 3-day grace → cancel + block ──
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingSubs, error: pendError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_id, current_period_end")
      .eq("status", "pending")
      .lt("current_period_end", threeDaysAgo);

    if (pendError) {
      console.error("Error fetching overdue pending subscriptions:", pendError);
    }

    if (pendingSubs && pendingSubs.length > 0) {
      console.log(`Phase 2: ${pendingSubs.length} pending subscriptions past 3-day grace`);

      for (const sub of pendingSubs) {
        const { error: cancelError } = await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", sub.id);

        if (cancelError) {
          console.error(`Error canceling subscription ${sub.id}:`, cancelError);
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", sub.user_id)
          .single();

        if (profile?.organization_id) {
          await supabase
            .from("organizations")
            .update({
              plan: "free",
              next_billing_date: null,
              status: "suspenso",
            })
            .eq("id", profile.organization_id);

          await supabase.from("org_notifications").insert({
            organization_id: profile.organization_id,
            title: "Acesso bloqueado",
            message:
              "Seu plano expirou há mais de 3 dias e o acesso premium foi bloqueado. Regularize o pagamento para reativar.",
            type: "billing",
          });

          console.log(`Org ${profile.organization_id} blocked (user: ${sub.user_id})`);
        }

        processedBlocked++;
      }
    }

    console.log(`Done: ${processedPending} set to pending, ${processedBlocked} blocked`);

    return new Response(
      JSON.stringify({
        ok: true,
        set_to_pending: processedPending,
        blocked: processedBlocked,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("check-subscription-expiry error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
