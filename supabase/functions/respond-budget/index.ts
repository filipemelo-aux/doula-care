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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { request_id, action } = await req.json();
    if (!request_id || !["accept", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "request_id and action (accept/reject) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the service request belongs to this user's client
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!clientData) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: serviceRequest } = await supabase
      .from("service_requests")
      .select("*")
      .eq("id", request_id)
      .eq("client_id", clientData.id)
      .eq("status", "budget_sent")
      .maybeSingle();

    if (!serviceRequest) {
      return new Response(JSON.stringify({ error: "Service request not found or already responded" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    // Update service request
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", request_id);

    if (updateError) throw updateError;

    // If accepted, create transaction (using service role - no RLS issue)
    if (action === "accept" && serviceRequest.budget_value) {
      await supabase.from("transactions").insert({
        client_id: clientData.id,
        type: "receita",
        description: `Serviço aprovado: ${serviceRequest.service_type}`,
        amount: serviceRequest.budget_value,
        date: new Date().toISOString().split("T")[0],
        payment_method: "pix",
        is_auto_generated: true,
      });
    }

    // Create notification for admin
    const emoji = action === "accept" ? "✅" : "❌";
    const actionText = action === "accept" ? "Aceito" : "Recusado";
    await supabase.from("client_notifications").insert({
      client_id: clientData.id,
      title: `${emoji} Orçamento ${actionText}: ${serviceRequest.service_type}`,
      message: `${clientData.full_name} ${action === "accept" ? "aceitou" : "recusou"} o orçamento de R$ ${(serviceRequest.budget_value || 0).toFixed(2).replace(".", ",")} para ${serviceRequest.service_type}.`,
      read: false,
    });

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
