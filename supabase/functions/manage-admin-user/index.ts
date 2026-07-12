import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MASTER_EMAIL = "filipe.silvamelo@live.com";
const PRIVILEGED_ROLES = ["admin", "moderator", "super_admin"] as const;

type AdminClient = ReturnType<typeof createClient>;
type DeleteCleanupStep = {
  label: string;
  run: () => Promise<{ error: { message: string } | null }>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateDefaultPassword(fullName: string): string {
  const firstName = (fullName || "User").trim().split(/\s+/)[0];
  const firstLetter = firstName.charAt(0).toUpperCase() || "U";
  const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
  // Include a symbol to satisfy stricter password policies and reduce HIBP collision odds
  return `${firstLetter}c!${digits}`;
}

async function getCallingUser(userClient: AdminClient, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Missing authorization" };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return { user: null, error: "Invalid token" };
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return { user: null, error: "Invalid token" };
  }

  return { user, error: null };
}

async function getCallerAccess(adminClient: AdminClient, callingUserId: string) {
  const { data: callerRoles, error: rolesError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callingUserId)
    .in("role", [...PRIVILEGED_ROLES]);

  if (rolesError) throw rolesError;
  if (!callerRoles || callerRoles.length === 0) {
    return { allowed: false, reason: "Admin, moderator or super_admin role required" };
  }

  const callerIsSuperAdmin = callerRoles.some((r) => r.role === "super_admin");
  const callerIsAdmin = callerRoles.some((r) => r.role === "admin");
  const callerIsModerator = callerRoles.some((r) => r.role === "moderator");

  let callerOrgId: string | null = null;

  if (!callerIsSuperAdmin) {
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callingUserId)
      .single();

    if (profileError) throw profileError;

    callerOrgId = callerProfile?.organization_id ?? null;

    if (callerOrgId) {
      const { data: org, error: orgError } = await adminClient
        .from("organizations")
        .select("status")
        .eq("id", callerOrgId)
        .single();

      if (orgError) throw orgError;

      if (org?.status === "suspenso") {
        return { allowed: false, reason: "Sua organização está suspensa" };
      }
    }
  }

  return {
    allowed: true,
    callerIsSuperAdmin,
    callerIsAdmin,
    callerIsModerator,
    callerOrgId,
  };
}

async function assertTargetManageable(
  adminClient: AdminClient,
  params: {
    callerUserId: string;
    callerEmail?: string;
    callerIsSuperAdmin: boolean;
    callerIsAdmin: boolean;
    callerIsModerator: boolean;
    callerOrgId: string | null;
    userId: string;
    requestedRole?: string;
    action: string;
  },
) {
  const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(params.userId);
  if (targetAuthError) throw targetAuthError;

  const targetEmail = targetAuth.user?.email;
  const targetIsMaster = targetEmail === MASTER_EMAIL;
  const callerIsMaster = params.callerEmail === MASTER_EMAIL;

  if (targetIsMaster && !callerIsMaster) {
    return { allowed: false, reason: "Não é permitido gerenciar o Super Admin master" };
  }

  if (!params.callerIsSuperAdmin) {
    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;

    if (params.callerOrgId && targetProfile?.organization_id !== params.callerOrgId) {
      return { allowed: false, reason: "Usuário não pertence à sua organização" };
    }
  }

  if (params.action === "delete" && params.userId === params.callerUserId) {
    return { allowed: false, reason: "Não é possível excluir seu próprio usuário" };
  }

  if (params.callerIsModerator && !params.callerIsAdmin && !params.callerIsSuperAdmin) {
    const { data: targetRoles, error: targetRolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", params.userId);

    if (targetRolesError) throw targetRolesError;

    const targetIsAdmin = targetRoles?.some((r) => r.role === "admin");
    if (targetIsAdmin) {
      return { allowed: false, reason: "Moderadores não podem gerenciar administradores" };
    }

    if (params.requestedRole === "admin") {
      return { allowed: false, reason: "Moderadores não podem atribuir o papel de administrador" };
    }
  }

  return { allowed: true };
}

async function deleteAdminUser(adminClient: AdminClient, userId: string) {
  const cleanupSteps: DeleteCleanupStep[] = [
    {
      label: "forum_reactions",
      run: () => adminClient.from("forum_reactions").delete().eq("user_id", userId),
    },
    {
      label: "appointments.owner_id",
      run: () => adminClient.from("appointments").update({ owner_id: null }).eq("owner_id", userId),
    },
    {
      label: "payments.owner_id",
      run: () => adminClient.from("payments").update({ owner_id: null }).eq("owner_id", userId),
    },
    {
      label: "transactions.owner_id",
      run: () => adminClient.from("transactions").update({ owner_id: null }).eq("owner_id", userId),
    },
    {
      label: "plan_settings.owner_id",
      run: () => adminClient.from("plan_settings").update({ owner_id: null }).eq("owner_id", userId),
    },
    {
      label: "admin_settings.owner_id",
      run: () => adminClient.from("admin_settings").update({ owner_id: null }).eq("owner_id", userId),
    },
    {
      label: "forum_comments",
      run: () => adminClient.from("forum_comments").delete().eq("author_id", userId),
    },
    {
      label: "forum_posts",
      run: () => adminClient.from("forum_posts").delete().eq("author_id", userId),
    },
    {
      label: "user_roles",
      run: () => adminClient.from("user_roles").delete().eq("user_id", userId),
    },
    {
      label: "profiles",
      run: () => adminClient.from("profiles").delete().eq("user_id", userId),
    },
    {
      label: "clients.user_id",
      run: () => adminClient.from("clients").update({ user_id: null }).eq("user_id", userId),
    },
  ];

  for (const step of cleanupSteps) {
    const { error } = await step.run();
    if (error) {
      throw new Error(`Falha ao limpar ${step.label}: ${error.message}`);
    }
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    throw new Error(`Falha ao excluir usuário da autenticação: ${deleteAuthError.message}`);
  }
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user: callingUser, error: authError } = await getCallingUser(userClient, authHeader);
    if (authError || !callingUser) {
      return jsonResponse({ error: authError ?? "Invalid token" }, 401);
    }

    const callerAccess = await getCallerAccess(adminClient, callingUser.id);
    if (!callerAccess.allowed) {
      return jsonResponse({ error: callerAccess.reason }, 403);
    }

    const { action, userId, fullName, role, email } = await req.json();

    if (!userId) {
      return jsonResponse({ error: "userId is required" }, 400);
    }

    const manageable = await assertTargetManageable(adminClient, {
      callerUserId: callingUser.id,
      callerEmail: callingUser.email,
      callerIsSuperAdmin: callerAccess.callerIsSuperAdmin,
      callerIsAdmin: callerAccess.callerIsAdmin,
      callerIsModerator: callerAccess.callerIsModerator,
      callerOrgId: callerAccess.callerOrgId,
      userId,
      requestedRole: role,
      action,
    });

    if (!manageable.allowed) {
      return jsonResponse({ error: manageable.reason }, 403);
    }

    if (action === "update") {
      if (role === "super_admin") {
        return jsonResponse({ error: "A atribuição de Super Admin está desativada" }, 403);
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

      return jsonResponse({ success: true, message: "Usuário atualizado" });
    }

    if (action === "delete") {
      await deleteAdminUser(adminClient, userId);
      return jsonResponse({ success: true, message: "Usuário excluído" });
    }

    if (action === "reset-password") {
      // Allow: super_admin (any user); admin of same org (admin or moderator targets);
      // moderator of same org (moderator targets only). Already guarded by assertTargetManageable above.
      const { data: targetRoles, error: targetRolesError } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (targetRolesError) throw targetRolesError;

      const targetIsTeam = targetRoles?.some((r) => r.role === "admin" || r.role === "moderator" || r.role === "super_admin");
      if (!targetIsTeam) {
        return jsonResponse({ error: "Só é possível resetar senhas de membros da equipe" }, 403);
      }

      const targetIsSuperAdmin = targetRoles?.some((r) => r.role === "super_admin");
      if (targetIsSuperAdmin && !callerAccess.callerIsSuperAdmin) {
        return jsonResponse({ error: "Apenas super admin pode resetar senha de super admin" }, 403);
      }

      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (targetProfileError) throw targetProfileError;

      const userName = targetProfile?.full_name || "User";
      const newPassword = generateDefaultPassword(userName);

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
      if (updateError) throw updateError;

      // Force the user to change this temporary password on next login
      await adminClient.from("profiles").update({ must_change_password: true }).eq("user_id", userId);

      return jsonResponse({ success: true, message: "Senha resetada", newPassword });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
