import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushSubscription,
  type PushMessage,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@^1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifySuperAdmins(supabase: any, doulaName: string, doulaEmail: string) {
  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) return;

    // Get super_admin user IDs
    const { data: superAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (!superAdminRoles || superAdminRoles.length === 0) return;

    const superAdminIds = superAdminRoles.map((r: any) => r.user_id);

    // Get push subscriptions for super admins
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
            body: `${doulaName} (${doulaEmail}) solicitou cadastro e aguarda aprovação.`,
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

    // 7. Notify super admins via push notification
    await notifySuperAdmins(supabase, fullName, email);

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
