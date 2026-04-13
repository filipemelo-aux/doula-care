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

    const now = new Date();
    const nowISO = now.toISOString();

    let processedPending = 0;
    let processedBlocked = 0;

    // ──────────────────────────────────────────────
    // PHASE 1 — Active subscriptions that just expired → set to "pending",
    //           generate new PIX charge and notify user
    // ──────────────────────────────────────────────
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
        // 1a. Set subscription to "pending"
        const { error: pendingError } = await supabase
          .from("subscriptions")
          .update({ status: "pending" })
          .eq("id", sub.id);

        if (pendingError) {
          console.error(`Error setting subscription ${sub.id} to pending:`, pendingError);
          continue;
        }

        // 1b. Determine billing_type from the subscription period length
        let billingType = "monthly";
        if (sub.current_period_end) {
          const start = new Date(sub.current_period_end);
          // If period was ~365 days, it's yearly; otherwise monthly
          // We look at the plan payment history to decide
          const { data: lastPayment } = await supabase
            .from("plan_payments")
            .select("billing_type")
            .eq("user_id", sub.user_id)
            .eq("plan_id", sub.plan_id)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastPayment?.billing_type) {
            billingType = lastPayment.billing_type;
          }
        }

        // 1c. Generate new payment via create-checkout-session
        try {
          const paymentResponse = await fetch(
            `${supabaseUrl}/functions/v1/create-checkout-session`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                plan_id: sub.plan_id,
                billing_type: billingType,
              }),
            }
          );

          if (!paymentResponse.ok) {
            const errBody = await paymentResponse.text();
            console.error(`Payment generation failed for user ${sub.user_id}:`, errBody);
          } else {
            console.log(`Payment generated for user ${sub.user_id}`);
          }
        } catch (payErr) {
          console.error(`Payment call error for user ${sub.user_id}:`, payErr);
        }

        // 1d. Notify user via org_notifications
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
              "Sua assinatura venceu. Realize o pagamento para continuar utilizando os recursos premium. Você tem 3 dias para regularizar.",
            type: "billing",
          });
        }

        // 1e. Also send push notification if possible
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
                "Sua assinatura venceu. Realize o pagamento em até 3 dias para continuar.",
            }),
          });
        } catch (_) {
          // Push is best-effort
        }

        processedPending++;
      }
    }

    // ──────────────────────────────────────────────
    // PHASE 2 — Pending subscriptions older than 3 days → cancel and block
    // ──────────────────────────────────────────────
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
        // 2a. Cancel subscription
        const { error: cancelError } = await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", sub.id);

        if (cancelError) {
          console.error(`Error canceling subscription ${sub.id}:`, cancelError);
          continue;
        }

        // 2b. Downgrade org to free and suspend
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
              status: "suspenso",
            })
            .eq("id", profile.organization_id);

          if (orgError) {
            console.error(`Error blocking org ${profile.organization_id}:`, orgError);
          } else {
            console.log(
              `Org ${profile.organization_id} blocked and downgraded (user: ${sub.user_id})`
            );
          }

          // 2c. Notify about block
          await supabase.from("org_notifications").insert({
            organization_id: profile.organization_id,
            title: "Acesso bloqueado",
            message:
              "Seu plano expirou há mais de 3 dias e o acesso premium foi bloqueado. Regularize o pagamento para reativar.",
            type: "billing",
          });
        }

        processedBlocked++;
      }
    }

    console.log(
      `Done: ${processedPending} set to pending, ${processedBlocked} blocked`
    );

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
