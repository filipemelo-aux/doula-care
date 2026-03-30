import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /**
     * Delegate push sending to the send-push-notification edge function.
     * This ensures FCM (Capacitor native) tokens are handled correctly
     * alongside web push (VAPID) subscriptions.
     */
    const sendPushToOrg = async (orgId: string, title: string, body: string) => {
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

      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: adminUserIds,
            title,
            message: body,
            url: "/admin",
            tag: "billing-overdue",
            type: "general",
            priority: "normal",
          },
        });
      } catch (err) {
        console.error("[billing] Push error:", err);
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

        const suspendMsg = "Sua conta foi suspensa automaticamente após 7 dias de atraso no pagamento. Entre em contato com o suporte para regularizar.";

        await supabase.from("org_notifications").insert({
          organization_id: orgId,
          title: "⛔ Conta suspensa por inadimplência",
          message: suspendMsg,
          type: "billing",
        });

        // Push notification
        await sendPushToOrg(orgId, "⛔ Conta suspensa", suspendMsg);
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
