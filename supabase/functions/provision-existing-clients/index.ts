import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeString(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function generateUsername(fullName: string): string {
  const parts = normalizeString(fullName).split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

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

    // Get all gestante clients without user_id but with DPP
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, dpp")
      .is("user_id", null)
      .not("dpp", "is", null)
      .eq("status", "gestante");

    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma gestante pendente encontrada", created: 0, errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results = { created: 0, errors: [] as string[], users: [] as { name: string; email: string }[] };

    for (const client of clients) {
      try {
        const username = generateUsername(client.full_name);
        const email = `${username}@gestante.doula.app`;
        const password = generatePassword(client.dpp);

        if (password.length < 4) {
          results.errors.push(`${client.full_name}: DPP inválido (senha muito curta)`);
          continue;
        }

        let finalEmail = email;
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: client.full_name, is_client: true },
        });

        if (createError) {
          if (createError.message.includes("already been registered")) {
            finalEmail = `${username}.${Date.now().toString().slice(-4)}@gestante.doula.app`;
            const { data: altUserData, error: altError } = await supabase.auth.admin.createUser({
              email: finalEmail, password, email_confirm: true,
              user_metadata: { full_name: client.full_name, is_client: true },
            });

            if (altError) { results.errors.push(`${client.full_name}: ${altError.message}`); continue; }

            if (altUserData.user) {
              await supabase.from("clients").update({ user_id: altUserData.user.id, first_login: true }).eq("id", client.id);
              await supabase.from("user_roles").insert({ user_id: altUserData.user.id, role: "client" });
              results.created++;
              results.users.push({ name: client.full_name, email: finalEmail });
            }
          } else {
            results.errors.push(`${client.full_name}: ${createError.message}`);
          }
          continue;
        }

        if (userData.user) {
          await supabase.from("clients").update({ user_id: userData.user.id, first_login: true }).eq("id", client.id);
          await supabase.from("user_roles").insert({ user_id: userData.user.id, role: "client" });
          results.created++;
          results.users.push({ name: client.full_name, email: finalEmail });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        results.errors.push(`${client.full_name}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({ message: `${results.created} usuário(s) criado(s) com sucesso`, created: results.created, users: results.users, errors: results.errors }),
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
