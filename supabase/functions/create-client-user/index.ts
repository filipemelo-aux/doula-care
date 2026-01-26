import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Remove accents and special characters from string
function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Generate username from full name (first.last)
function generateUsername(fullName: string): string {
  const parts = normalizeString(fullName).split(/\s+/);
  if (parts.length < 2) {
    return parts[0];
  }
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

// Generate password from DPP (DDMMAA format - day, month, year last 2 digits)
function generatePassword(dpp: string): string {
  // DPP format is YYYY-MM-DD
  const parts = dpp.split("-");
  if (parts.length === 3) {
    const year = parts[0].slice(-2); // last 2 digits of year
    const month = parts[1];
    const day = parts[2];
    return `${day}${month}${year}`;
  }
  // Fallback
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { clientId, fullName, dpp } = await req.json();

    if (!clientId || !fullName || !dpp) {
      throw new Error("Missing required fields: clientId, fullName, dpp");
    }

    const username = generateUsername(fullName);
    const email = `${username}@gestante.doula.app`;
    const password = generatePassword(dpp);

    if (password.length < 4) {
      throw new Error("DPP inválido para gerar senha");
    }

    // Check if user already exists for this client
    const { data: existingClient } = await supabase
      .from("clients")
      .select("user_id")
      .eq("id", clientId)
      .single();

    if (existingClient?.user_id) {
      return new Response(
        JSON.stringify({ 
          message: "Usuário já existe para esta cliente",
          exists: true,
          email 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create user with service role
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        is_client: true 
      },
    });

    if (createError) {
      // If email already exists, try with a number suffix
      if (createError.message.includes("already been registered")) {
        const altEmail = `${username}.${Date.now().toString().slice(-4)}@gestante.doula.app`;
        const { data: altUserData, error: altError } = await supabase.auth.admin.createUser({
          email: altEmail,
          password,
          email_confirm: true,
          user_metadata: { 
            full_name: fullName,
            is_client: true 
          },
        });

        if (altError) throw altError;
        
        if (altUserData.user) {
          // Update client with user_id
          await supabase
            .from("clients")
            .update({ user_id: altUserData.user.id, first_login: true })
            .eq("id", clientId);

          // Assign client role
          await supabase
            .from("user_roles")
            .insert({ user_id: altUserData.user.id, role: "client" });

          return new Response(
            JSON.stringify({ 
              message: "Usuário criado com sucesso",
              email: altEmail,
              user: { id: altUserData.user.id }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      throw createError;
    }

    if (userData.user) {
      // Update client with user_id
      await supabase
        .from("clients")
        .update({ user_id: userData.user.id, first_login: true })
        .eq("id", clientId);

      // Assign client role
      await supabase
        .from("user_roles")
        .insert({ user_id: userData.user.id, role: "client" });
    }

    return new Response(
      JSON.stringify({ 
        message: "Usuário criado com sucesso",
        email,
        user: { id: userData.user?.id }
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
