import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) => console.log(`[approve-pix-payment] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const reviewer = userData?.user;
    if (!reviewer) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Verifica super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", reviewer.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id, action, notes } = await req.json();
    if (!id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "id e action (approve|reject) obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pix, error: fetchErr } = await admin
      .from("plan_pix_payments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !pix) {
      return new Response(JSON.stringify({ error: "Registro não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pix.status !== "awaiting_confirmation") {
      return new Response(JSON.stringify({ error: "Registro já foi processado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    await admin.from("plan_pix_payments").update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer.id,
      review_notes: notes ?? null,
    }).eq("id", id);

    if (action === "approve") {
      // Ativa assinatura
      const now = new Date();
      const periodEnd = new Date(now);
      if (pix.billing_type === "yearly") {
        periodEnd.setDate(periodEnd.getDate() + 365);
      } else {
        periodEnd.setDate(periodEnd.getDate() + 30);
      }

      // Cancela assinaturas ativas anteriores
      await admin.from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", pix.user_id)
        .eq("status", "active");

      await admin.from("subscriptions").insert({
        user_id: pix.user_id,
        plan_id: pix.plan_id,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });

      // Atualiza organização
      const { data: planData } = await admin
        .from("platform_plan_limits")
        .select("plan, name")
        .eq("id", pix.plan_id)
        .maybeSingle();

      if (pix.organization_id && planData) {
        await admin.from("organizations").update({
          plan: planData.plan as "free" | "pro" | "premium",
          billing_cycle: pix.billing_type === "yearly" ? "yearly" : "monthly",
          next_billing_date: periodEnd.toISOString().split("T")[0],
          status: "ativo",
        }).eq("id", pix.organization_id);

        // Notifica a doula
        await admin.from("org_notifications").insert({
          organization_id: pix.organization_id,
          title: "✅ Pagamento confirmado",
          message: `Seu pagamento via Pix do plano ${planData.name} foi confirmado e seu plano está ativo.`,
          type: "billing",
        });
      }

      log("Pix approved & subscription activated", { userId: pix.user_id });
    } else {
      // Rejeitado: notifica
      if (pix.organization_id) {
        await admin.from("org_notifications").insert({
          organization_id: pix.organization_id,
          title: "❌ Pagamento Pix não confirmado",
          message: notes
            ? `Seu pagamento Pix não foi confirmado. Motivo: ${notes}`
            : "Seu pagamento Pix não foi confirmado. Entre em contato com o suporte.",
          type: "billing",
        });
      }
      log("Pix rejected", { id });
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
