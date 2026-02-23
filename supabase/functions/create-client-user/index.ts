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

    const { clientId, fullName, dpp, organizationId } = await req.json();

    if (!clientId || !fullName || !dpp) {
      throw new Error("Missing required fields: clientId, fullName, dpp");
    }

    // ORG ISOLATION: Verify client belongs to caller's org
    const { data: clientCheck } = await supabase
      .from("clients")
      .select("organization_id, user_id")
      .eq("id", clientId)
      .single();

    if (callerOrgId && clientCheck?.organization_id !== callerOrgId) {
      return new Response(
        JSON.stringify({ error: "Cliente não pertence à sua organização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (clientCheck?.user_id) {
      const username = generateUsername(fullName);
      const email = `${username}@gestante.doula.app`;
      return new Response(
        JSON.stringify({ message: "Usuário já existe para esta cliente", exists: true, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const username = generateUsername(fullName);
    const email = `${username}@gestante.doula.app`;
    const password = generatePassword(dpp);

    if (password.length < 4) {
      throw new Error("DPP inválido para gerar senha");
    }

    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, is_client: true },
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        const altEmail = `${username}.${Date.now().toString().slice(-4)}@gestante.doula.app`;
        const { data: altUserData, error: altError } = await supabase.auth.admin.createUser({
          email: altEmail, password, email_confirm: true,
          user_metadata: { full_name: fullName, is_client: true },
        });

        if (altError) throw altError;
        
        if (altUserData.user) {
          await supabase.from("clients").update({ user_id: altUserData.user.id, first_login: true }).eq("id", clientId);
          await supabase.from("user_roles").insert({ user_id: altUserData.user.id, role: "client" });
          // Use caller's org, not client-provided one
          const effectiveOrgId = callerOrgId || organizationId;
          if (effectiveOrgId) {
            await supabase.from("profiles").update({ organization_id: effectiveOrgId }).eq("user_id", altUserData.user.id);
          }

          return new Response(
            JSON.stringify({ message: "Usuário criado com sucesso", email: altEmail, user: { id: altUserData.user.id } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      throw createError;
    }

    if (userData.user) {
      await supabase.from("clients").update({ user_id: userData.user.id, first_login: true }).eq("id", clientId);
      await supabase.from("user_roles").insert({ user_id: userData.user.id, role: "client" });
      // Use caller's org, not client-provided one
      const effectiveOrgId = callerOrgId || organizationId;
      if (effectiveOrgId) {
        await supabase.from("profiles").update({ organization_id: effectiveOrgId }).eq("user_id", userData.user.id);
      }
    }

    return new Response(
      JSON.stringify({ message: "Usuário criado com sucesso", email, user: { id: userData.user?.id } }),
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
