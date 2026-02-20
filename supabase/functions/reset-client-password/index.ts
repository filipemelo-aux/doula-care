import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(dpp: string): string {
  const parts = dpp.split("-");
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const month = parts[1];
    const day = parts[2];
    return `${day}${month}${year}`;
  }
  return dpp.replace(/\D/g, "").slice(0, 6);
}

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

    // Verify caller is authenticated admin/moderator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error("Missing required field: clientId");
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, dpp, user_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) throw new Error("Cliente não encontrado");
    if (!client.user_id) throw new Error("Cliente não possui acesso ao sistema");
    if (!client.dpp) throw new Error("Cliente não possui DPP cadastrada");

    const newPassword = generatePassword(client.dpp);
    if (newPassword.length < 4) throw new Error("DPP inválida para gerar senha");

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      client.user_id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    await supabase.from("clients").update({ first_login: true }).eq("id", clientId);

    return new Response(
      JSON.stringify({ 
        message: "Senha resetada com sucesso",
        hint: `Nova senha: dia e mês da DPP (${newPassword.slice(0, 2)}/${newPassword.slice(2, 4)})`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
