import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const body = await req.json();
    const {
      email,
      password,
      fullName,
      preferredName,
      phone,
      cpf,
      // address
      street, number, neighborhood, city, state, zip_code,
      latitude, longitude,
      // gestational
      status, dpp, pregnancy_weeks,
      // health
      prenatal_high_risk, prenatal_type, comorbidades, alergias, restricao_aromaterapia,
      // support
      companion_name, companion_phone,
      has_fotografa, fotografa_name, fotografa_phone,
      instagram_gestante, instagram_acompanhante,
      birth_location,
    } = body || {};

    if (!email || !password || !fullName || !phone) {
      return new Response(
        JSON.stringify({ error: "Dados básicos obrigatórios: nome, email, senha e telefone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (String(password).length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailLower = String(email).toLowerCase().trim();

    // 1. Create auth user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, is_visitor: true },
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

    // 2. Assign visitor role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "visitor" });
    if (roleError) {
      await supabase.auth.admin.deleteUser(userId);
      throw roleError;
    }

    // 3. Create client record (no organization yet)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        full_name: fullName,
        preferred_name: preferredName || null,
        phone,
        cpf: cpf || null,
        street: street || null,
        number: number || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        status: status || "gestante",
        dpp: dpp || null,
        pregnancy_weeks: pregnancy_weeks ?? null,
        prenatal_high_risk: !!prenatal_high_risk,
        prenatal_type: prenatal_type || null,
        comorbidades: comorbidades || null,
        alergias: alergias || null,
        restricao_aromaterapia: restricao_aromaterapia || null,
        companion_name: companion_name || null,
        companion_phone: companion_phone || null,
        has_fotografa: !!has_fotografa,
        fotografa_name: fotografa_name || null,
        fotografa_phone: fotografa_phone || null,
        instagram_gestante: instagram_gestante || null,
        instagram_acompanhante: instagram_acompanhante || null,
        birth_location: birth_location || null,
        user_id: userId,
        is_visitor: true,
        organization_id: null,
        owner_id: null,
        plan: "basico",
        payment_method: "pix",
        payment_status: "pendente",
        plan_value: 0,
        visitor_latitude: latitude ?? null,
        visitor_longitude: longitude ?? null,
        first_login: false,
      })
      .select("id")
      .single();

    if (clientError) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
      throw clientError;
    }

    return new Response(
      JSON.stringify({
        message: "Cadastro de visitante realizado com sucesso",
        user: { id: userId, email: emailLower },
        clientId: client.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("register-visitor error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
