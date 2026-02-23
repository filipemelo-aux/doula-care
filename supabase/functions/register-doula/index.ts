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

    const { fullName, email, password } = await req.json();

    // Validate inputs
    if (!fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nome, email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create auth user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw createError;
    }

    const userId = userData.user!.id;

    // 2. Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: fullName,
        responsible_email: email,
        plan: "free",
        status: "pendente",
      })
      .select("id")
      .single();

    if (orgError) {
      // Rollback: delete the created user
      await supabase.auth.admin.deleteUser(userId);
      throw orgError;
    }

    // 3. Assign admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      await supabase.auth.admin.deleteUser(userId);
      throw roleError;
    }

    // 4. Update profile with organization_id and full_name
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ organization_id: org.id, full_name: fullName })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Non-critical, don't rollback
    }

    // 5. Create default admin_settings
    await supabase.from("admin_settings").insert({
      owner_id: userId,
      organization_id: org.id,
    });

    // 6. Create default plan_settings
    const defaultPlans = [
      { plan_type: "basico", name: "Básico", default_value: 0, owner_id: userId, organization_id: org.id },
      { plan_type: "intermediario", name: "Intermediário", default_value: 0, owner_id: userId, organization_id: org.id },
      { plan_type: "completo", name: "Completo", default_value: 0, owner_id: userId, organization_id: org.id },
    ];
    await supabase.from("plan_settings").insert(defaultPlans);

    return new Response(
      JSON.stringify({
        message: "Cadastro realizado com sucesso",
        user: { id: userId, email },
        organizationId: org.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
