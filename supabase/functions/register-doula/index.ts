import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateProfessionalEmail } from "../_shared/email-guard.ts";
import {
  buildPushPayload,
  type PushSubscription,
  type PushMessage,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@^1.0.2";

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

function isValidCPF(raw: string): boolean {
  const cpf = String(raw || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

async function notifySuperAdmins(supabase: any, doulaName: string, doulaEmail: string) {
  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) return;

    const { data: superAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (!superAdminRoles || superAdminRoles.length === 0) return;

    const superAdminIds = superAdminRoles.map((r: any) => r.user_id);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", superAdminIds);

    if (!subscriptions || subscriptions.length === 0) return;

    const vapid: VapidKeys = {
      subject: "mailto:contato@papodedoula.com",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const pushMessage: PushMessage = {
          data: JSON.stringify({
            title: "Nova doula cadastrada!",
            body: `${doulaName} (${doulaEmail}) se cadastrou e já está ativa.`,
            icon: "/pwa-icon-192.png",
            badge: "/pwa-icon-192.png",
            url: "/super-admin",
            tag: "new-doula-registration",
            type: "general",
            priority: "normal",
            require_interaction: true,
          }),
          options: { ttl: 86400, urgency: "high" },
        };

        const payload = await buildPushPayload(pushMessage, pushSubscription, vapid);
        const response = await fetch(sub.endpoint, payload);

        if (response.status === 410 || response.status === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      } catch (err) {
        console.error(`Push error for ${sub.endpoint}:`, err);
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
  } catch (err) {
    console.error("Error notifying super admins:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 0. O cadastro só é aceito depois da verificação do e-mail por código,
    //    que deixa o usuário autenticado.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ error: "Confirme o código enviado para o seu e-mail antes de concluir." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userRes, error: userErr } = await authClient.auth.getUser();
    const authUser = userRes?.user;
    if (userErr || !authUser) {
      return json({ error: "Sessão de verificação expirada. Recomece o cadastro." }, 401);
    }
    if (!authUser.email_confirmed_at) {
      return json({ error: "E-mail ainda não verificado." }, 403);
    }

    const userId = authUser.id;
    const email = (authUser.email ?? "").toLowerCase();

    const emailCheck = await validateProfessionalEmail(email);
    if (!emailCheck.ok) return json({ error: emailCheck.error }, 400);

    // Já concluiu o cadastro antes?
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (existingRoles && existingRoles.length > 0) {
      return json({ error: "Este e-mail já possui uma conta ativa. Faça login." }, 409);
    }

    const b = await req.json().catch(() => ({}));
    const fullName = String(b.fullName ?? "").trim();
    const password = String(b.password ?? "");
    const cpf = String(b.cpf ?? "").replace(/\D/g, "");
    const birthDate = String(b.birthDate ?? "");
    const whatsapp = String(b.whatsapp ?? "").trim();
    const instagram = String(b.instagram ?? "").trim().replace(/^@/, "");
    const postalCode = String(b.postalCode ?? "").replace(/\D/g, "");
    const street = String(b.street ?? "").trim();
    const streetNumber = String(b.streetNumber ?? "").trim();
    const neighborhood = String(b.neighborhood ?? "").trim();
    const city = String(b.city ?? "").trim();
    const state = String(b.state ?? "").trim().toUpperCase();
    const doulaTraining = String(b.doulaTraining ?? "").trim();
    const practiceSince = Number(b.practiceSince ?? 0);
    const bio = String(b.bio ?? "").trim();
    const serviceAreas: string[] = Array.isArray(b.serviceAreas)
      ? b.serviceAreas.map((a: unknown) => String(a).trim()).filter(Boolean).slice(0, 20)
      : [];
    const avatarUrl = b.avatarUrl ? String(b.avatarUrl) : null;
    const consentVersion = String(b.consentVersion ?? "");

    const fail = (msg: string) => json({ error: msg }, 400);

    if (fullName.length < 5 || !fullName.includes(" ")) return fail("Informe o nome completo");
    if (password.length < 6) return fail("A senha deve ter pelo menos 6 caracteres");
    if (!isValidCPF(cpf)) return fail("CPF inválido");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return fail("Data de nascimento inválida");
    const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (!(age >= 18 && age <= 100)) return fail("É necessário ter 18 anos ou mais");
    if (whatsapp.replace(/\D/g, "").length < 10) return fail("WhatsApp inválido");
    if (instagram.length < 2) return fail("Instagram obrigatório");
    if (postalCode.length !== 8) return fail("CEP inválido");
    if (!city || state.length !== 2) return fail("Cidade e estado obrigatórios");
    if (doulaTraining.length < 2) return fail("Informe sua formação");
    if (!(practiceSince >= 1970 && practiceSince <= new Date().getFullYear())) {
      return fail("Ano de início de atuação inválido");
    }
    if (!consentVersion) return fail("É necessário aceitar a política de privacidade");

    // CPF único entre as doulas
    const { data: cpfTaken } = await supabase
      .from("doula_personal_data")
      .select("user_id")
      .eq("cpf", cpf)
      .neq("user_id", userId)
      .maybeSingle();
    if (cpfTaken) return json({ error: "Este CPF já está cadastrado." }, 409);

    // 1. Define a senha da conta já verificada
    const { error: pwError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name: fullName },
    });
    if (pwError) throw pwError;

    // 2. Cria a organização
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: fullName,
        nome_exibicao: fullName,
        responsible_email: email,
        plan: "pro",
        status: "ativo",
        whatsapp,
        instagram,
        postal_code: postalCode,
        street,
        street_number: streetNumber,
        neighborhood,
        city,
        state,
        bio: bio || null,
        service_areas: serviceAreas.length > 0 ? serviceAreas : [city],
        doula_training: doulaTraining,
        practice_since: practiceSince,
      })
      .select("id")
      .single();
    if (orgError) throw orgError;

    // 3. Papel de administradora
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleError) throw roleError;

    // 4. Perfil (welcome_seen = false libera a boas-vindas da doula)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        organization_id: org.id,
        full_name: fullName,
        welcome_seen: false,
        avatar_url: avatarUrl,
        lgpd_consent_at: new Date().toISOString(),
        lgpd_consent_version: consentVersion,
        profile_completed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (profileError) console.error("Error updating profile:", profileError);

    // 5. Dados pessoais sensíveis, em tabela de acesso restrito
    const { error: personalError } = await supabase
      .from("doula_personal_data")
      .upsert(
        { user_id: userId, organization_id: org.id, cpf, birth_date: birthDate },
        { onConflict: "user_id" }
      );
    if (personalError) console.error("Error saving personal data:", personalError);

    // 6. Configurações padrão
    await supabase.from("admin_settings").insert({
      owner_id: userId,
      organization_id: org.id,
    });

    await supabase.from("org_notifications").insert({
      organization_id: org.id,
      title: "🎉 Bem-vinda ao Doula Care!",
      message: "Sua conta está ativa com todos os recursos liberados. Aproveite!",
      type: "info",
    });

    await notifySuperAdmins(supabase, fullName, email);

    return json({
      message: "Cadastro realizado com sucesso",
      user: { id: userId, email },
      organizationId: org.id,
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return json({ error: message }, 500);
  }
});
