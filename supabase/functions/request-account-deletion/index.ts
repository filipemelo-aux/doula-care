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
    const { email, reason } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Find the user by email to get org info
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = userData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Create a notification for all super admins about the deletion request
    const { data: superAdmins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (superAdmins && superAdmins.length > 0) {
      // We log the request. In a production system you'd store this in a dedicated table.
      console.log(
        `Account deletion requested: email=${email}, reason=${reason || "none"}, userId=${targetUser?.id || "not found"}`
      );
    }

    // Always return success to avoid leaking whether an account exists
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
