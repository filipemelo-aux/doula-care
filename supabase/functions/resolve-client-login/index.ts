import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username || typeof username !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing username" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const baseUsername = username.toLowerCase().trim();

    // Find clients with user_id set
    const { data: clients, error } = await supabase
      .from("clients")
      .select("user_id, full_name")
      .not("user_id", "is", null);

    if (error || !clients) {
      return new Response(
        JSON.stringify({ email: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Match username pattern: nome.sobrenome
    for (const c of clients) {
      const nameParts = c.full_name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .split(/\s+/);

      if (nameParts.length >= 2) {
        const expectedUsername = `${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
        if (expectedUsername === baseUsername) {
          // Found match — get actual email from auth
          const { data: userData } = await supabase.auth.admin.getUserById(c.user_id);
          if (userData?.user?.email) {
            return new Response(
              JSON.stringify({ email: userData.user.email }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ email: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error resolving client login:", error);
    return new Response(
      JSON.stringify({ email: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
