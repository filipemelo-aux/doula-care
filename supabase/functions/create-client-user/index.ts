import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nameParts(fullName: string): string[] {
  return (fullName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
}

function generateUsername(fullName: string): string {
  const parts = nameParts(fullName);
  if (parts.length === 0) return "";
  if (parts.length < 2) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

function generatePassword(dpp: string): string {
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
  // Prefix "dpp" to avoid HIBP rejection of common 6-digit passwords
  return `dpp${digits}`;
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

    const body = await req.json();
    const { clientId, fullName, dpp, organizationId } = body;
    const customUsername = typeof body.username === "string" ? body.username.toLowerCase().trim() : "";
    const customPassword = typeof body.password === "string" ? body.password.trim() : "";

    if (!clientId || !fullName) throw new Error("Informe a cliente");

    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: clientCheck } = await supabase
      .from("clients").select("organization_id, user_id").eq("id", clientId).single();

    if (!clientCheck || (callerOrgId && clientCheck.organization_id !== callerOrgId)) {
      return json({ error: "Cliente não pertence à sua organização" }, 403);
    }
    if (clientCheck.user_id) return json({ error: "Esta cliente já possui acesso" }, 409);

    const username = customUsername || generateUsername(fullName);
    if (!/^[a-z0-9][a-z0-9._-]{2,40}$/.test(username)) {
      return json({ error: "Usuário inválido: use letras sem acento, números, ponto ou traço (mín. 3)" }, 400);
    }
    const password = customPassword || (dpp ? generatePassword(dpp) : "");
    if (password.length < 6) return json({ error: "A senha precisa ter pelo menos 6 caracteres" }, 400);

    const email = `${username}@gestante.doula.app`;
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, is_client: true },
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        return json({ error: `O usuário "${username}" já está em uso. Escolha outro.` }, 409);
      }
      if (/weak|pwned|leaked/i.test(createError.message)) {
        return json({ error: "Senha muito comum. Escolha outra senha." }, 400);
      }
      return json({ error: createError.message }, 400);
    }

    const newId = userData.user!.id;
    await supabase.from("clients").update({ user_id: newId, first_login: true }).eq("id", clientId);
    await supabase.from("user_roles").insert({ user_id: newId, role: "client" });
    const effectiveOrgId = callerOrgId || organizationId;
    if (effectiveOrgId) {
      await supabase.from("profiles").update({ organization_id: effectiveOrgId }).eq("user_id", newId);
    }

    return json({ message: "Usuário criado com sucesso", email, username, user: { id: newId } });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
