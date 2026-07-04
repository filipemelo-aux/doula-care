import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !callingUser) return jsonResponse({ error: "Invalid token" }, 401);

    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "moderator"]);

    const callerIsAdmin = callerRoles?.some((r) => r.role === "admin") ?? false;
    const callerIsModerator = callerRoles?.some((r) => r.role === "moderator") ?? false;

    if (!callerIsAdmin && !callerIsModerator) {
      return jsonResponse({ error: "Admin or moderator role required" }, 403);
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callingUser.id)
      .single();

    if (callerProfile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("status")
        .eq("id", callerProfile.organization_id)
        .single();
      if (org?.status === "suspenso") {
        return jsonResponse({ error: "Sua organização está suspensa" }, 403);
      }
    }

    const { email, password, fullName, role, organizationId, sendInvite } = await req.json();

    if (role === "super_admin") {
      return jsonResponse({ error: "A atribuição de Super Admin está desativada" }, 403);
    }
    if (role === "admin" && !callerIsAdmin) {
      return jsonResponse({ error: "Moderadores não podem criar administradores" }, 403);
    }
    if (!["admin", "moderator"].includes(role)) {
      return jsonResponse({ error: "Papel inválido. Use 'admin' ou 'moderator'." }, 400);
    }
    if (!email) {
      return jsonResponse({ error: "Email é obrigatório" }, 400);
    }
    if (!sendInvite && !password) {
      return jsonResponse({ error: "Informe uma senha ou marque enviar convite por email" }, 400);
    }

    // Pre-check duplicate email so we can give clear feedback
    const { data: existingList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    // listUsers doesn't filter — fallback: try create and detect duplicate below

    let createdUserId: string | null = null;

    if (sendInvite) {
      // Send invite email (Supabase default sender); user sets own password via link
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name: fullName } }
      );
      if (inviteError) {
        if (inviteError.message?.toLowerCase().includes("already")) {
          return jsonResponse({ error: "Este email já está cadastrado no sistema", code: "duplicate_email" }, 409);
        }
        console.error("inviteUser error:", inviteError);
        return jsonResponse({ error: "Não foi possível enviar o convite" }, 500);
      }
      createdUserId = inviteData.user?.id ?? null;
    } else {
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        if (createError.message?.toLowerCase().includes("already")) {
          return jsonResponse({ error: "Este email já está cadastrado no sistema", code: "duplicate_email" }, 409);
        }
        console.error("createUser error:", createError);
        return jsonResponse({ error: "Não foi possível criar o usuário" }, 500);
      }
      createdUserId = userData.user?.id ?? null;
    }

    if (createdUserId) {
      await supabase.from("user_roles").insert({ user_id: createdUserId, role });

      const profileUpdate: Record<string, unknown> = {};
      if (organizationId) profileUpdate.organization_id = organizationId;
      // Force password change on first login when admin set the initial password.
      // When sendInvite is used, the user already defines their own password.
      if (!sendInvite) profileUpdate.must_change_password = true;

      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from("profiles").update(profileUpdate).eq("user_id", createdUserId);
      }
    }

    return jsonResponse({
      message: sendInvite ? "Convite enviado" : "Usuário criado com sucesso",
      user: { id: createdUserId, email },
      invited: !!sendInvite,
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: "Operação falhou. Tente novamente." }, 500);
  }
});
