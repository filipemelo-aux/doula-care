import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateDefaultPassword(fullName: string): string {
  const firstName = (fullName || "User").trim().split(/\s+/)[0];
  const firstLetter = firstName.charAt(0).toUpperCase();
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstLetter}${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: callingUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "moderator", "super_admin"]);

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin, moderator or super_admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerIsSuperAdmin = callerRoles.some((r) => r.role === "super_admin");
    const callerIsAdmin = callerRoles.some((r) => r.role === "admin");
    const callerIsModerator = callerRoles.some((r) => r.role === "moderator");

    let callerOrgId: string | null = null;
    if (!callerIsSuperAdmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", callingUser.id)
        .single();

      callerOrgId = callerProfile?.organization_id ?? null;

      if (callerOrgId) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("status")
          .eq("id", callerOrgId)
          .single();

        if (org?.status === "suspenso") {
          return new Response(JSON.stringify({ error: "Sua organização está suspensa" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { action, userId, fullName, role, email } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MASTER_EMAIL = "filipe.silvamelo@live.com";
    const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(userId);
    if (targetAuthError) throw targetAuthError;

    const targetEmail = targetAuth.user?.email;
    const targetIsMaster = targetEmail === MASTER_EMAIL;
    const callerIsMaster = callingUser.email === MASTER_EMAIL;

    if (targetIsMaster && !callerIsMaster) {
      return new Response(JSON.stringify({ error: "Não é permitido gerenciar o Super Admin master" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callerIsSuperAdmin) {
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (callerOrgId && targetProfile?.organization_id !== callerOrgId) {
        return new Response(JSON.stringify({ error: "Usuário não pertence à sua organização" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "delete" && userId === callingUser.id) {
      return new Response(JSON.stringify({ error: "Não é possível excluir seu próprio usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerIsModerator && !callerIsAdmin && !callerIsSuperAdmin) {
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const targetIsAdmin = targetRoles?.some((r) => r.role === "admin");
      if (targetIsAdmin) {
        return new Response(JSON.stringify({ error: "Moderadores não podem gerenciar administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role === "admin") {
        return new Response(JSON.stringify({ error: "Moderadores não podem atribuir o papel de administrador" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update") {
      if (role === "super_admin") {
        return new Response(JSON.stringify({ error: "A atribuição de Super Admin está desativada" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (fullName !== undefined) {
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ full_name: fullName })
          .eq("user_id", userId);
        if (profileError) throw profileError;
      }

      if (email !== undefined && email !== "") {
        const { error: emailError } = await adminClient.auth.admin.updateUserById(userId, { email });
        if (emailError) throw emailError;
      }

      if (role !== undefined) {
        const { error: deleteRolesError } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .neq("role", "client");
        if (deleteRolesError) throw deleteRolesError;

        if (role) {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .insert({ user_id: userId, role });
          if (roleError) throw roleError;
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário atualizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { error: deleteReactionsError } = await adminClient
        .from("forum_reactions")
        .delete()
        .eq("user_id", userId);
      if (deleteReactionsError) throw deleteReactionsError;

      const { error: clearAppointmentsOwnerError } = await adminClient
        .from("appointments")
        .update({ owner_id: null })
        .eq("owner_id", userId);
      if (clearAppointmentsOwnerError) throw clearAppointmentsOwnerError;

      const { error: clearPaymentsOwnerError } = await adminClient
        .from("payments")
        .update({ owner_id: null })
        .eq("owner_id", userId);
      if (clearPaymentsOwnerError) throw clearPaymentsOwnerError;

      const { error: clearTransactionsOwnerError } = await adminClient
        .from("transactions")
        .update({ owner_id: null })
        .eq("owner_id", userId);
      if (clearTransactionsOwnerError) throw clearTransactionsOwnerError;

      const { error: clearPlanSettingsOwnerError } = await adminClient
        .from("plan_settings")
        .update({ owner_id: null })
        .eq("owner_id", userId);
      if (clearPlanSettingsOwnerError) throw clearPlanSettingsOwnerError;

      const { error: deleteRolesError } = await adminClient.from("user_roles").delete().eq("user_id", userId);
      if (deleteRolesError) throw deleteRolesError;

      const { error: deleteProfileError } = await adminClient.from("profiles").delete().eq("user_id", userId);
      if (deleteProfileError) throw deleteProfileError;

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        throw new Error(`Falha ao excluir usuário da autenticação: ${deleteAuthError.message}`);
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário excluído" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset-password") {
      if (!callerIsSuperAdmin) {
        return new Response(JSON.stringify({ error: "Apenas super admin pode resetar senhas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const targetIsAdminOrSuper = targetRoles?.some((r) => r.role === "admin" || r.role === "super_admin");
      if (!targetIsAdminOrSuper) {
        return new Response(JSON.stringify({ error: "Só é possível resetar senhas de administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      const userName = targetProfile?.full_name || "User";
      const newPassword = generateDefaultPassword(userName);

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "Senha resetada", newPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
