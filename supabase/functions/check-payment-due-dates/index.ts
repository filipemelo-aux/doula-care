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
      .select("*, clients(id, full_name, user_id)")
      .eq("due_date", todayStr)
      .neq("status", "pago");

    // Find payments due in 2 days
    const { data: dueSoon } = await supabase
      .from("payments")
      .select("*, clients(id, full_name, user_id)")
      .eq("due_date", twoDaysStr)
      .neq("status", "pago");

    // Find overdue payments (due_date < today, not paid) - send once per day
    const { data: overdue } = await supabase
      .from("payments")
      .select("*, clients(id, full_name, user_id)")
      .lt("due_date", todayStr)
      .neq("status", "pago");

    const notifications: Array<{
      client_id: string;
      title: string;
      message: string;
    }> = [];

    const formatCurrency = (v: number) =>
      `R$ ${v.toFixed(2).replace(".", ",")}`;

    // Due in 2 days
    for (const p of dueSoon || []) {
      if (!p.clients?.id) continue;
      notifications.push({
        client_id: p.clients.id,
        title: "💰 Pagamento se aproximando",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} vence em 2 dias (${new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}).`,
      });
    }

    // Due today
    for (const p of dueToday || []) {
      if (!p.clients?.id) continue;
      notifications.push({
        client_id: p.clients.id,
        title: "💰 Pagamento vence hoje",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} vence hoje.`,
      });
    }

    // Overdue
    for (const p of overdue || []) {
      if (!p.clients?.id) continue;
      // Check if we already sent an overdue notification today for this payment
      const { count } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", p.clients.id)
        .like("title", "🚨 Pagamento em atraso%")
        .gte("created_at", todayStr + "T00:00:00Z");

      if ((count || 0) > 0) continue;

      notifications.push({
        client_id: p.clients.id,
        title: "🚨 Pagamento em atraso",
        message: `Sua parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))} estava prevista para ${new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")} e ainda não foi registrada.`,
      });
    }

    // Insert all notifications
    if (notifications.length > 0) {
      await supabase.from("client_notifications").insert(notifications);
    }

    // Send push notifications for due today and overdue
    const pushTargets = [...(dueToday || []), ...(overdue || [])].filter(
      (p) => p.clients?.user_id
    );

    for (const p of pushTargets) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: [p.clients.user_id],
            title:
              p.due_date === todayStr
                ? "💰 Pagamento vence hoje"
                : "🚨 Pagamento em atraso",
            message: `Parcela ${p.installment_number}/${p.total_installments} de ${formatCurrency(Number(p.amount))}`,
            url: "/gestante/mensagens",
            tag: "payment-reminder",
          },
        });
      } catch (e) {
        console.error("Push error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: notifications.length,
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
