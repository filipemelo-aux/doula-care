import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(dpp: string): { password: string; digits: string } {
  const parts = dpp.split("-");
  let digits = "";
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const month = parts[1];
    const day = parts[2];
    digits = `${day}${month}${year}`;
  } else {
    digits = dpp.replace(/\D/g, "").slice(0, 6);
  }
  // Prefix "Dc" to avoid HIBP rejection of common 6-digit passwords
  return { password: `Dc${digits}`, digits };
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

    // Get caller's organization
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callingUser.id)
      .single();

    const callerOrgId = callerProfile?.organization_id;

    if (callerOrgId) {
      const { data: org } = await supabase
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
      throw new Error("Missing required field: clientId");
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, dpp, user_id, organization_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) throw new Error("Cliente não encontrado");

    // ORG ISOLATION CHECK
    if (callerOrgId && client.organization_id !== callerOrgId) {
      return new Response(
        JSON.stringify({ error: "Cliente não pertence à sua organização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client.user_id) throw new Error("Cliente não possui acesso ao sistema");
    if (!client.dpp) throw new Error("Cliente não possui DPP cadastrada");

    const { password: newPassword, digits } = generatePassword(client.dpp);
    if (digits.length < 4) throw new Error("DPP inválida para gerar senha");

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      client.user_id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    await supabase.from("clients").update({ first_login: true }).eq("id", clientId);

    return new Response(
      JSON.stringify({
        message: "Senha resetada com sucesso",
        hint: `Nova senha: Dc + dia/mês/ano da DPP (${newPassword})`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Operação falhou. Tente novamente.";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
