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
    if (!request_id || !["accept", "reject", "accept_date", "reject_date"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "request_id and action (accept/reject/accept_date/reject_date) required" }),
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

    // Handle date acceptance/rejection
    if (action === "accept_date" || action === "reject_date") {
      const { data: serviceRequest } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", request_id)
        .eq("client_id", clientData.id)
        .eq("status", "date_proposed")
        .maybeSingle();

      if (!serviceRequest) {
        return new Response(JSON.stringify({ error: "Service request not found or not in date_proposed status" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "accept_date") {
        // Client accepted proposed date → move to accepted (in progress)
        const { error: updateError } = await supabase
          .from("service_requests")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", request_id);
        if (updateError) throw updateError;

        // Create transaction if budget exists
        if (serviceRequest.budget_value) {
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

        // Notify admin
        await supabase.from("client_notifications").insert({
          client_id: clientData.id,
          title: `✅ Data Aceita: ${serviceRequest.service_type}`,
          message: `${clientData.full_name} aceitou a data proposta para ${serviceRequest.service_type}.`,
          read: false,
        });
      } else {
        // Client rejected proposed date → back to budget_sent so doula can propose again
        const { error: updateError } = await supabase
          .from("service_requests")
          .update({ status: "budget_sent", scheduled_date: null })
          .eq("id", request_id);
        if (updateError) throw updateError;

        await supabase.from("client_notifications").insert({
          client_id: clientData.id,
          title: `❌ Data Recusada: ${serviceRequest.service_type}`,
          message: `${clientData.full_name} recusou a data proposta para ${serviceRequest.service_type}. Proponha uma nova data.`,
          read: false,
        });
      }

      return new Response(
        JSON.stringify({ success: true, status: action === "accept_date" ? "accepted" : "budget_sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Original budget accept/reject flow
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

    if (action === "reject") {
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", request_id);
      if (updateError) throw updateError;

      await supabase.from("client_notifications").insert({
        client_id: clientData.id,
        title: `❌ Orçamento Recusado: ${serviceRequest.service_type}`,
        message: `${clientData.full_name} recusou o orçamento de R$ ${(serviceRequest.budget_value || 0).toFixed(2).replace(".", ",")} para ${serviceRequest.service_type}.`,
        read: false,
      });

      return new Response(
        JSON.stringify({ success: true, status: "rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action === "accept"
    // Check if doula proposed a different date than client's preferred date
    const datesDiffer = serviceRequest.preferred_date &&
      serviceRequest.scheduled_date &&
      serviceRequest.preferred_date !== serviceRequest.scheduled_date;

    if (datesDiffer) {
      // Budget accepted but date needs confirmation → date_proposed
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({ status: "date_proposed", responded_at: new Date().toISOString() })
        .eq("id", request_id);
      if (updateError) throw updateError;

      await supabase.from("client_notifications").insert({
        client_id: clientData.id,
        title: `📅 Confirme a Data: ${serviceRequest.service_type}`,
        message: `${clientData.full_name} aceitou o orçamento, mas a data proposta é diferente. Confirme a nova data.`,
        read: false,
      });

      return new Response(
        JSON.stringify({ success: true, status: "date_proposed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dates match or no preferred date → directly accepted
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", request_id);
    if (updateError) throw updateError;

    // Create transaction
    if (serviceRequest.budget_value) {
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

    // Notify admin
    await supabase.from("client_notifications").insert({
      client_id: clientData.id,
      title: `✅ Orçamento Aceito: ${serviceRequest.service_type}`,
      message: `${clientData.full_name} aceitou o orçamento de R$ ${(serviceRequest.budget_value || 0).toFixed(2).replace(".", ",")} para ${serviceRequest.service_type}.`,
      read: false,
    });

    return new Response(
      JSON.stringify({ success: true, status: "accepted" }),
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
