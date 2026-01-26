import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate password from DPP (day and month only - ddmm format + suffix for min 6 chars)
function generatePassword(dpp: string): string {
  // DPP format is YYYY-MM-DD, extract day and month
  const parts = dpp.split("-");
  if (parts.length === 3) {
    const day = parts[2];
    const month = parts[1];
    // Add "gg" suffix to ensure 6+ characters (gestante)
    return `${day}${month}gg`;
  }
  // Fallback: extract only numbers (first 4 digits for ddmm) + suffix
  return dpp.replace(/\D/g, "").slice(0, 4) + "gg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error("Missing required field: clientId");
    }

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, dpp, user_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      throw new Error("Cliente não encontrado");
    }

    if (!client.user_id) {
      throw new Error("Cliente não possui acesso ao sistema");
    }

    if (!client.dpp) {
      throw new Error("Cliente não possui DPP cadastrada");
    }

    const newPassword = generatePassword(client.dpp);

    if (newPassword.length < 4) {
      throw new Error("DPP inválida para gerar senha");
    }

    // Reset the password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      client.user_id,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    // Reset first_login to true so they're forced to change password again
    await supabase
      .from("clients")
      .update({ first_login: true })
      .eq("id", clientId);

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
