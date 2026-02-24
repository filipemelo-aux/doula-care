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

    // Only super_admin can delete organizations
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Super Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org info
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all clients in this org
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, user_id")
      .eq("organization_id", organizationId);

    const clientIds = (clients || []).map(c => c.id);
    const clientUserIds = (clients || []).filter(c => c.user_id).map(c => c.user_id!);

    // Delete client-related records
    if (clientIds.length > 0) {
      await supabaseAdmin.from("contractions").delete().in("client_id", clientIds);
      await supabaseAdmin.from("pregnancy_diary").delete().in("client_id", clientIds);
      await supabaseAdmin.from("client_notifications").delete().in("client_id", clientIds);
      await supabaseAdmin.from("service_requests").delete().in("client_id", clientIds);
      await supabaseAdmin.from("appointments").delete().in("client_id", clientIds);
      await supabaseAdmin.from("payments").delete().in("client_id", clientIds);
      
      // Delete transactions linked to clients
      await supabaseAdmin.from("transactions").delete().in("client_id", clientIds);
    }

    // Delete org-level records
    await supabaseAdmin.from("org_billing").delete().eq("organization_id", organizationId);
    await supabaseAdmin.from("org_notifications").delete().eq("organization_id", organizationId);
    await supabaseAdmin.from("custom_services").delete().eq("organization_id", organizationId);
    await supabaseAdmin.from("plan_settings").delete().eq("organization_id", organizationId);
    await supabaseAdmin.from("admin_settings").delete().eq("organization_id", organizationId);
    
    // Delete remaining transactions for the org
    await supabaseAdmin.from("transactions").delete().eq("organization_id", organizationId);

    // Delete clients
    if (clientIds.length > 0) {
      await supabaseAdmin.from("clients").delete().in("id", clientIds);
    }

    // Get admin/moderator profiles linked to this org
    const { data: orgProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", organizationId);

    const adminUserIds = (orgProfiles || []).map(p => p.user_id);

    // Delete profiles
    // We can't delete profiles due to RLS, but with service role we can
    if (adminUserIds.length > 0) {
      await supabaseAdmin.from("user_roles").delete().in("user_id", adminUserIds);
      await supabaseAdmin.from("push_subscriptions").delete().in("user_id", adminUserIds);
      await supabaseAdmin.from("profiles").delete().in("user_id", adminUserIds);
    }

    // Delete the organization
    const { error: deleteOrgError } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (deleteOrgError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete organization", details: deleteOrgError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete auth users (clients first, then admins)
    for (const userId of clientUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    for (const userId of adminUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Organization "${org.name}" deleted`,
        orgName: org.name,
        deletedClients: clientIds.length,
        deletedUsers: clientUserIds.length + adminUserIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-organization function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
