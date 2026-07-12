import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userRes.user.id;

    // Verify admin/moderator
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "moderator" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callerId)
      .maybeSingle();
    const adminOrgId = adminProfile?.organization_id;

    const form = await req.formData();
    const clientId = form.get("client_id") as string | null;
    const action = (form.get("action") as string | null) || "upload";
    const file = form.get("file") as File | null;

    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, user_id, organization_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client || !client.user_id) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado ou sem usuário" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Super admins are also allowed to override org check
    const isSuper = (roles || []).some((r: any) => r.role === "super_admin");
    if (!isSuper && client.organization_id !== adminOrgId) {
      return new Response(JSON.stringify({ error: "Cliente de outra organização" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = client.user_id;
    const path = `${targetUserId}/avatar.jpg`;

    if (action === "remove") {
      await admin.storage.from("avatars").remove([
        `${targetUserId}/avatar.jpg`,
        `${targetUserId}/avatar.png`,
        `${targetUserId}/avatar.webp`,
        `${targetUserId}/avatar.jpeg`,
      ]);
      const { error: upErr } = await admin
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", targetUserId);
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ avatar_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > 3 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Arquivo > 3MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: stErr } = await admin.storage
      .from("avatars")
      .upload(path, bytes, { upsert: true, contentType: "image/jpeg" });
    if (stErr) throw stErr;

    const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: upErr } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", targetUserId);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ avatar_url: avatarUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-upload-client-avatar error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
