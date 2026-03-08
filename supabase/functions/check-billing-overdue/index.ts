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
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vapid: VapidKeys | null = vapidPublicKey && vapidPrivateKey ? {
      subject: "mailto:contato@papodedoula.com",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    } : null;

    const sendPushToOrg = async (orgId: string, title: string, body: string) => {
      if (!vapid) return;
      // Get admin users in this org
      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId);
      if (!orgProfiles || orgProfiles.length === 0) return;

      const orgUserIds = orgProfiles.map(p => p.user_id);
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"])
        .in("user_id", orgUserIds);
      if (!adminRoles || adminRoles.length === 0) return;

      const adminUserIds = adminRoles.map(r => r.user_id);
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", adminUserIds);
      if (!subscriptions || subscriptions.length === 0) return;

      for (const sub of subscriptions) {
        try {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          const pushMessage: PushMessage = {
            data: JSON.stringify({
              title, body, icon: "/pwa-icon-192.png", badge: "/pwa-icon-192.png",
              url: "/admin", tag: "billing-overdue", type: "general", priority: "normal",
            }),
            options: { ttl: 3600, urgency: "normal" },
          };
          const payload = await buildPushPayload(pushMessage, pushSubscription, vapid);
          await fetch(sub.endpoint, payload);
        } catch (err) {
          console.error("Push error:", err);
        }
      }
    };

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // 1. Mark pending billings as "atrasado" if past due date
    const { data: overdueBillings } = await supabase
      .from("org_billing")
      .select("id, organization_id, amount, due_date")
      .eq("status", "pendente")
      .lt("due_date", todayStr)
      .not("due_date", "is", null);

    let markedOverdue = 0;
    for (const bill of overdueBillings || []) {
      const { error } = await supabase
        .from("org_billing")
        .update({ status: "atrasado" })
        .eq("id", bill.id);

      if (!error) {
        markedOverdue++;

        const billingMessage = `Sua cobrança de ${Number(bill.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} venceu em ${new Date(bill.due_date + "T12:00:00").toLocaleDateString("pt-BR")} e está em atraso.`;

        // Notify the doula (in-app)
        await supabase.from("org_notifications").insert({
          organization_id: bill.organization_id,
          title: "🚨 Pagamento em atraso",
          message: billingMessage,
          type: "billing",
          billing_id: bill.id,
        });

        // Push notification to admin
        await sendPushToOrg(bill.organization_id, "🚨 Pagamento em atraso", billingMessage);
      }
    }

    // 2. Suspend orgs with billings overdue for 7+ days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: longOverdue } = await supabase
      .from("org_billing")
      .select("id, organization_id, due_date")
      .eq("status", "atrasado")
      .lte("due_date", sevenDaysAgoStr)
      .not("due_date", "is", null);

    // Get unique org IDs to suspend
    const orgIdsToSuspend = [...new Set((longOverdue || []).map((b) => b.organization_id))];

    let suspended = 0;
    for (const orgId of orgIdsToSuspend) {
      // Check if org is still active (don't re-suspend)
      const { data: org } = await supabase
        .from("organizations")
        .select("status")
        .eq("id", orgId)
        .single();

      if (org?.status !== "ativo") continue;

      const { error } = await supabase
        .from("organizations")
        .update({ status: "suspenso" })
        .eq("id", orgId);

      if (!error) {
        suspended++;

        await supabase.from("org_notifications").insert({
          organization_id: orgId,
          title: "⛔ Conta suspensa por inadimplência",
          message: "Sua conta foi suspensa automaticamente após 7 dias de atraso no pagamento. Entre em contato com o suporte para regularizar.",
          type: "billing",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        markedOverdue,
        suspended,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
