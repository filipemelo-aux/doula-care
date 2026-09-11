import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateProfessionalEmail } from "../_shared/email-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => ({}));
    const check = await validateProfessionalEmail(body?.email ?? "");
    if (!check.ok) return json({ error: check.error }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Se já existe uma conta concluída com esse e-mail, não faz sentido cadastrar.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === check.email);
    if (existing) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", existing.id);
      if (roles && roles.length > 0) {
        return json({ error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." }, 409);
      }
    }

    // Envia o código de 6 dígitos usando a infraestrutura de e-mail do projeto.
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await publicClient.auth.signInWithOtp({
      email: check.email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      const msg = String(error.message || "");
      if (/rate limit|too many/i.test(msg)) {
        return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
      }
      if (/invalid/i.test(msg)) {
        return json({ error: "Não foi possível enviar o código para este e-mail." }, 400);
      }
      throw error;
    }

    return json({ sent: true, email: check.email });
  } catch (error) {
    console.error("send-signup-code error:", error);
    return json({ error: "Não foi possível enviar o código agora. Tente novamente." }, 500);
  }
});
