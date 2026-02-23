import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify caller is admin or moderator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin or moderator
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "moderator"]);

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin or moderator role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate caller's organization is active
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
        return new Response(JSON.stringify({ error: "Sua organização está suspensa" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const callerIsAdmin = callerRoles.some((r) => r.role === "admin");
    const callerIsModerator = callerRoles.some((r) => r.role === "moderator");

    const { action, userId, fullName, role, email } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (action === "delete" && userId === callingUser.id) {
      return new Response(JSON.stringify({ error: "Não é possível excluir seu próprio usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If caller is moderator, check that target is NOT an admin
    if (callerIsModerator && !callerIsAdmin) {
      const { data: targetRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const targetIsAdmin = targetRoles?.some((r) => r.role === "admin");
      if (targetIsAdmin) {
        return new Response(JSON.stringify({ error: "Moderadores não podem gerenciar administradores" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Moderators cannot assign admin role
      if (role === "admin") {
        return new Response(JSON.stringify({ error: "Moderadores não podem atribuir o papel de administrador" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update") {
      // Update profile name
      if (fullName !== undefined) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("user_id", userId);
        if (profileError) throw profileError;
      }

      // Update email
      if (email !== undefined && email !== "") {
        const { error: emailError } = await supabase.auth.admin.updateUserById(userId, { email });
        if (emailError) throw emailError;
      }

      // Update role
      if (role !== undefined) {
        // Delete existing roles for this user (non-client)
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .neq("role", "client");

        // Insert new role
        if (role) {
          const { error: roleError } = await supabase
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
      // Delete roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Delete profile
      await supabase.from("profiles").delete().eq("user_id", userId);
      // Delete auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true, message: "Usuário excluído" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
