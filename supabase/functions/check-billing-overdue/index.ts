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

        // Notify the doula
        await supabase.from("org_notifications").insert({
          organization_id: bill.organization_id,
          title: "🚨 Pagamento em atraso",
          message: `Sua cobrança de ${Number(bill.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} venceu em ${new Date(bill.due_date + "T12:00:00").toLocaleDateString("pt-BR")} e está em atraso.`,
          type: "billing",
          billing_id: bill.id,
        });
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
