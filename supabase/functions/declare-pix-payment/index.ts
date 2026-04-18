import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[declare-pix-payment] ${step}${d}`);
};

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
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json();
    const { plan_id, billing_type } = body ?? {};
    if (!plan_id || !["monthly", "yearly"].includes(billing_type)) {
      return new Response(JSON.stringify({ error: "plan_id e billing_type (monthly|yearly) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: plan } = await admin
      .from("platform_plan_limits")
      .select("id, name, price_monthly, price_yearly, is_free")
      .eq("id", plan_id)
      .maybeSingle();
    if (!plan || plan.is_free) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isYearly = billing_type === "yearly";
    const amount = isYearly
      ? (plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly * 12)
      : plan.price_monthly;

    // Pega organização do usuário
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Cria registro
    const { data: inserted, error: insErr } = await admin
      .from("plan_pix_payments")
      .insert({
        user_id: user.id,
        organization_id: profile?.organization_id ?? null,
        plan_id,
        billing_type,
        amount,
        status: "awaiting_confirmation",
      })
      .select("id")
      .single();

    if (insErr) {
      log("Insert error", insErr);
      return new Response(JSON.stringify({ error: "Falha ao registrar pagamento" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notifica TODOS os super admins via push
    const { data: superAdminIds } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    const ids = (superAdminIds ?? []).map((r: any) => r.user_id);
    const valor = (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const doulaName = profile?.full_name || user.email || "Doula";

    if (ids.length > 0) {
      const pushRes = await admin.functions.invoke("send-push-notification", {
        body: {
          user_ids: ids,
          title: "🚨 Pagamento Pix declarado",
          message: `${doulaName} declarou pagamento de ${valor} (Plano ${plan.name}). Confirme no painel.`,
          url: "/superadmin?section=billing",
          tag: `pix-${inserted.id}`,
          priority: "critica",
          require_interaction: true,
        },
      }).catch((e) => ({ error: e }));
      log("Push invoke result", pushRes);
    }

    log("Pix payment declared", { id: inserted.id, amount, doulaName });

    return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
