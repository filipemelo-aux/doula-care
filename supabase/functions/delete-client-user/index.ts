import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller's organization
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callingUser.id)
      .single();

    const callerOrgId = callerProfile?.organization_id;

    if (callerOrgId) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("status")
        .eq("id", callerOrgId)
        .single();

      if (org?.status === "suspenso") {
        return new Response(
          JSON.stringify({ error: "Sua organização está suspensa" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify client belongs to caller's organization
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("user_id, full_name, organization_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ORG ISOLATION CHECK
    if (callerOrgId && client.organization_id !== callerOrgId) {
      return new Response(
        JSON.stringify({ error: "Cliente não pertence à sua organização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = client.user_id;

    // Delete related records first
    await supabaseAdmin.from("contractions").delete().eq("client_id", clientId);
    await supabaseAdmin.from("pregnancy_diary").delete().eq("client_id", clientId);
    await supabaseAdmin.from("client_notifications").delete().eq("client_id", clientId);
    await supabaseAdmin.from("service_requests").delete().eq("client_id", clientId);
    await supabaseAdmin.from("appointments").delete().eq("client_id", clientId);

    const { error: deleteClientError } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (deleteClientError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete client", details: deleteClientError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userId) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteUserError) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: "Client deleted but failed to remove auth user",
            clientName: client.full_name 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: userId ? "Client and user account deleted" : "Client deleted (no user account)",
        clientName: client.full_name
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-client-user function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
