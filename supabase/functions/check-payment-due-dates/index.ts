import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const twoDaysStr = twoDaysLater.toISOString().split("T")[0];

    // Find payments due today
    const { data: dueToday } = await supabase
      .from("payments")
      .select("*, clients(id, full_name, user_id, organization_id)")
      .eq("due_date", todayStr)
      .neq("status", "pago");

    // Find payments due in 2 days
    const { data: dueSoon } = await supabase
      .from("payments")
      .select("*, clients(id, full_name, user_id, organization_id)")
      .eq("due_date", twoDaysStr)
      .neq("status", "pago");

    // Find overdue payments (due_date < today, not paid) - send once per day
    const { data: overdue } = await supabase
      .from("payments")
      .select("*, clients(id, full_name, user_id, organization_id)")
      .lt("due_date", todayStr)
      .neq("status", "pago");

    const clientNotifications: Array<{
      client_id: string;
      title: string;
      message: string;
      organization_id?: string;
    }> = [];

    const formatCurrency = (v: number) =>
      `R$ ${v.toFixed(2).replace(".", ",")}`;

    // Due in 2 days — notify client
    for (const p of dueSoon || []) {
      if (!p.clients?.id) continue;
      clientNotifications.push({
        client_id: p.clients.id,
        title: "💰 Pagamento se aproximando",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} vence em 2 dias (${new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}).`,
        organization_id: p.clients.organization_id || undefined,
      });
    }

    // Due today — notify client
    for (const p of dueToday || []) {
      if (!p.clients?.id) continue;
      clientNotifications.push({
        client_id: p.clients.id,
        title: "💰 Pagamento vence hoje",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} vence hoje.`,
        organization_id: p.clients.organization_id || undefined,
      });
    }

    // Overdue — notify client (once per day)
    for (const p of overdue || []) {
      if (!p.clients?.id) continue;
      const { count } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", p.clients.id)
        .like("title", "🚨 Pagamento em atraso%")
        .gte("created_at", todayStr + "T00:00:00Z");

      if ((count || 0) > 0) continue;

      clientNotifications.push({
        client_id: p.clients.id,
        title: "🚨 Pagamento em atraso",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} estava prevista para ${new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")} e ainda não foi registrada.`,
        organization_id: p.clients.organization_id || undefined,
      });
    }

    // Insert all client notifications
    if (clientNotifications.length > 0) {
      await supabase.from("client_notifications").insert(clientNotifications);
    }

    // === ADMIN/DOULA NOTIFICATIONS ===
    // Collect unique org IDs that had payment notifications
    const orgPaymentMap = new Map<string, Array<{ clientName: string; type: string; amount: number; installment: number; total: number; dueDate: string }>>();

    const allPayments = [
      ...(dueSoon || []).map(p => ({ ...p, notifType: "vence em 2 dias" })),
      ...(dueToday || []).map(p => ({ ...p, notifType: "vence hoje" })),
      ...(overdue || []).map(p => ({ ...p, notifType: "em atraso" })),
    ];

    for (const p of allPayments) {
      if (!p.clients?.organization_id || !p.clients?.id) continue;
      const orgId = p.clients.organization_id;
      if (!orgPaymentMap.has(orgId)) orgPaymentMap.set(orgId, []);
      orgPaymentMap.get(orgId)!.push({
        clientName: p.clients.full_name,
        type: p.notifType,
        amount: Number(p.amount),
        installment: p.installment_number,
        total: p.total_installments,
        dueDate: p.due_date,
      });
    }

    // For each org, send notification to admins
    let adminNotifCount = 0;
    for (const [orgId, payments] of orgPaymentMap.entries()) {
      // Get admin user_ids for this org
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId);

      if (!adminProfiles || adminProfiles.length === 0) continue;

      const adminUserIds: string[] = [];
      for (const profile of adminProfiles) {
        // Check if this user is actually an admin/moderator
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .in("role", ["admin", "moderator"]);

        if (roles && roles.length > 0) {
          adminUserIds.push(profile.user_id);
        }
      }

      if (adminUserIds.length === 0) continue;

      // Build a summary notification for admins
      const overdueItems = payments.filter(p => p.type === "em atraso");
      const dueTodayItems = payments.filter(p => p.type === "vence hoje");
      const dueSoonItems = payments.filter(p => p.type === "vence em 2 dias");

      const lines: string[] = [];
      for (const item of dueSoonItems) {
        lines.push(`📅 ${item.clientName} — parcela ${item.installment}/${item.total} de ${formatCurrency(item.amount)} vence em 2 dias`);
      }
      for (const item of dueTodayItems) {
        lines.push(`⚠️ ${item.clientName} — parcela ${item.installment}/${item.total} de ${formatCurrency(item.amount)} vence hoje`);
      }
      for (const item of overdueItems) {
        lines.push(`🚨 ${item.clientName} — parcela ${item.installment}/${item.total} de ${formatCurrency(item.amount)} em atraso`);
      }

      const title = "💰 Cobranças enviadas às gestantes";
      const message = lines.join("\n");

      // Insert org_notification for admin dashboard
      await supabase.from("org_notifications").insert({
        organization_id: orgId,
        title,
        message,
        type: "billing",
      });

      // Send push notification to admins
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: adminUserIds,
            title,
            message: lines.length > 1
              ? `${lines.length} cobranças enviadas — toque para ver`
              : lines[0],
            url: "/financeiro",
            tag: "admin-payment-alert",
            type: "payment_received",
          },
        });
      } catch (e) {
        console.error("Admin push error:", e);
      }

      adminNotifCount++;
    }

    // Send push notifications to clients
    const allPushTargets = [
      ...(dueSoon || []).map(p => ({ ...p, pushTitle: "💰 Pagamento se aproximando", pushMsg: `Parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} vence em 2 dias` })),
      ...(dueToday || []).map(p => ({ ...p, pushTitle: "💰 Pagamento vence hoje", pushMsg: `Parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))}` })),
      ...(overdue || []).map(p => ({ ...p, pushTitle: "🚨 Pagamento em atraso", pushMsg: `Parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))}` })),
    ].filter(p => p.clients?.user_id);

    for (const p of allPushTargets) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: [p.clients.user_id],
            title: p.pushTitle,
            message: p.pushMsg,
            url: "/gestante/mensagens",
            tag: "payment-reminder",
            type: "payment_received",
          },
        });
      } catch (e) {
        console.error("Push error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientNotificationsSent: clientNotifications.length,
        adminOrgNotifications: adminNotifCount,
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
