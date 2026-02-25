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

    const { fullName, cpf } = await req.json();

    if (!fullName || !cpf) {
      return new Response(
        JSON.stringify({ error: "Nome completo e CPF são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean CPF - remove formatting
    const cleanCpf = cpf.replace(/\D/g, "");

    if (cleanCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format CPF for matching both stored formats
    const formattedCpf = `${cleanCpf.slice(0,3)}.${cleanCpf.slice(3,6)}.${cleanCpf.slice(6,9)}-${cleanCpf.slice(9)}`;

    // Search for client matching CPF (try both clean and formatted)
    const { data: clients, error: searchError } = await supabase
      .from("clients")
      .select("id, full_name, cpf, dpp, user_id, first_login")
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
      .limit(10);

    console.log("Search params:", { cleanCpf, formattedCpf, fullName, clientsFound: clients?.length });

    if (searchError) throw searchError;

    // Find matching client (normalize name comparison)
    const normalizedInput = normalizeString(fullName);
    const matchingClient = clients?.find((c) => {
      const normalizedDbName = normalizeString(c.full_name);
      return normalizedDbName === normalizedInput;
    });

    if (!matchingClient) {
      return new Response(
        JSON.stringify({ error: "Nenhum cadastro encontrado com esse nome e CPF" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user account exists
    if (!matchingClient.user_id) {
      return new Response(
        JSON.stringify({ error: "Seu acesso ainda não foi liberado pela sua doula. Entre em contato com ela." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already changed password
    if (!matchingClient.first_login) {
      const username = generateUsername(matchingClient.full_name);
      return new Response(
        JSON.stringify({
          found: true,
          alreadyChanged: true,
          username: `${username}@gestante.doula.app`,
          message: "Você já alterou sua senha. Use seu usuário para fazer login. Caso tenha esquecido a senha, entre em contato com sua doula.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Client still on first login - show credentials
    if (!matchingClient.dpp) {
      return new Response(
        JSON.stringify({ error: "Sua DPP ainda não foi cadastrada. Entre em contato com sua doula." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const username = generateUsername(matchingClient.full_name);
    const password = generatePassword(matchingClient.dpp);

    // Also check actual email from auth (in case of alt email)
    let actualEmail = `${username}@gestante.doula.app`;
    const { data: authUser } = await supabase.auth.admin.getUserById(matchingClient.user_id);
    if (authUser?.user?.email) {
      actualEmail = authUser.user.email;
    }

    return new Response(
      JSON.stringify({
        found: true,
        alreadyChanged: false,
        username: actualEmail,
        password: password,
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
