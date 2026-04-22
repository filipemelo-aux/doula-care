import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { request_id } = body as { request_id?: string };
    if (!request_id) return new Response(JSON.stringify({ error: "request_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirm the request belongs to this visitor
    const { data: req_row, error: rErr } = await admin
      .from("doula_match_requests")
      .select("id, organization_id, visitor_user_id, plan_name, plan_value")
      .eq("id", request_id)
      .maybeSingle();
    if (rErr || !req_row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (req_row.visitor_user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find all admin/moderator user_ids of that org
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", req_row.organization_id);
    const userIds = (profs || []).map((p: any) => p.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds)
      .in("role", ["admin", "moderator"]);
    const recipients = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Invoke the existing push function
    const valueText = req_row.plan_value
      ? Number(req_row.plan_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "";
    await admin.functions.invoke("send-push-notification", {
      body: {
        user_ids: recipients,
        title: "Nova solicitação de vínculo 💜",
        message: `Uma gestante quer iniciar com você${req_row.plan_name ? ` (Plano ${req_row.plan_name}${valueText ? ` · ${valueText}` : ""})` : ""}.`,
        url: "/admin",
        type: "general",
        tag: `match-${request_id}`,
        require_interaction: true,
      },
    });

    return new Response(JSON.stringify({ ok: true, sent: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
