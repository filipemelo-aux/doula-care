import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isNotificationDeviceList, matchesNotificationDevice, parseNotificationDevices } from "../_shared/notificationDevice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authorization.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Autenticação inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { postId, authorId, authorName, postTitle, isAnonymous, audience, target_device = "all" } = await req.json();
    if (!isNotificationDeviceList(target_device)) {
      return new Response(JSON.stringify({ error: "Dispositivo inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetDevices = parseNotificationDevices(target_device);
    const { data: post } = await supabase.from("forum_posts").select("author_id").eq("id", postId).maybeSingle();
    if (!post || post.author_id !== user.id || authorId !== user.id) {
      return new Response(JSON.stringify({ error: "Publicação não autorizada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!postId || !authorId || !postTitle) {
      return new Response(
        JSON.stringify({ error: "postId, authorId e postTitle são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDoulasOnly = audience === "doulas_only";
    const isGestantesOnly = audience === "gestantes_only";
    const displayAuthor = isAnonymous ? "Anônima" : (authorName || "Alguém");
    const notifTitle = "💬 Nova publicação na Comunidade";
    const notifMessage = `${displayAuthor} publicou: "${postTitle.substring(0, 80)}${postTitle.length > 80 ? "..." : ""}"`;

    // 1. Get all admin/moderator user IDs with their org (skip if gestantes_only)
    const adminUserIds: string[] = [];
    const adminOrgMap = new Map<string, string>();

    if (!isGestantesOnly) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);

      const rawAdminIds = (adminRoles || [])
        .map((r: any) => r.user_id)
        .filter((id: string) => id !== authorId);

      adminUserIds.push(...rawAdminIds);

      if (adminUserIds.length > 0) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("user_id, organization_id")
          .in("user_id", adminUserIds);

        for (const p of adminProfiles || []) {
          if (p.organization_id) {
            adminOrgMap.set(p.user_id, p.organization_id);
          }
        }
      }
    }

    // 2. Get client data (skip entirely if doulas_only)
    const clientOrgMap = new Map<string, { clientId: string; orgId: string | null }>();
    const clientUserIds: string[] = [];

    if (!isDoulasOnly) {
      const { data: clientRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      const rawClientUserIds = (clientRoles || [])
        .map((r: any) => r.user_id)
        .filter((id: string) => id !== authorId);

      clientUserIds.push(...rawClientUserIds);

      if (clientUserIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, user_id, organization_id")
          .in("user_id", clientUserIds);

        for (const c of clients || []) {
          if (c.user_id) {
            clientOrgMap.set(c.user_id, { clientId: c.id, orgId: c.organization_id });
          }
        }
      }
    }

    // Device-specific broadcasts only notify users with subscriptions on that platform.
    if (!targetDevices.includes("all")) {
      const ids = [...new Set([...adminUserIds, ...clientUserIds])];
      const { data: subscriptions, error } = await supabase.from("push_subscriptions")
        .select("user_id, token_type, device_type").in("user_id", ids);
      if (error) throw error;
      const eligible = new Set((subscriptions ?? []).filter(sub => matchesNotificationDevice(sub, targetDevices)).map(sub => sub.user_id));
      for (let i = adminUserIds.length - 1; i >= 0; i--) {
        if (!eligible.has(adminUserIds[i])) {
          adminOrgMap.delete(adminUserIds[i]);
          adminUserIds.splice(i, 1);
        }
      }
      for (let i = clientUserIds.length - 1; i >= 0; i--) {
        if (!eligible.has(clientUserIds[i])) {
          clientOrgMap.delete(clientUserIds[i]);
          clientUserIds.splice(i, 1);
        }
      }
    }

    // 3. Insert org_notifications for admins (batched)
    const orgNotifications = Array.from(adminOrgMap.entries()).map(([_, orgId]) => ({
      organization_id: orgId,
      title: notifTitle,
      message: notifMessage,
      type: "community",
      read: false,
    }));

    if (orgNotifications.length > 0) {
      await supabase.from("org_notifications").insert(orgNotifications);
    }

    // 4. Insert client_notifications for clients (batched) — skip if doulas_only
    if (!isDoulasOnly) {
      const clientNotifications = Array.from(clientOrgMap.values()).map((c) => ({
        client_id: c.clientId,
        organization_id: c.orgId,
        title: notifTitle,
        message: notifMessage,
        read: false,
        read_by_client: false,
      }));

      if (clientNotifications.length > 0) {
        await supabase.from("client_notifications").insert(clientNotifications);
      }
    }

    // 5. Send push notification to admins (url: /comunidade)
    if (adminUserIds.length > 0) {
      await supabase.functions.invoke("send-push-notification", {
        headers: { Authorization: authorization },
        body: {
          user_ids: adminUserIds,
          title: notifTitle,
          message: notifMessage,
          url: "/comunidade",
          tag: `forum-post-${postId}`,
          type: "community",
          priority: "normal",
          target_device: targetDevices.join(","),
        },
      });
    }

    // 6. Send push notification to clients (url: /gestante/comunidade) — skip if doulas_only
    if (!isDoulasOnly) {
      const clientPushIds = clientUserIds.filter((id: string) => clientOrgMap.has(id));
      if (clientPushIds.length > 0) {
        await supabase.functions.invoke("send-push-notification", {
          headers: { Authorization: authorization },
          body: {
            user_ids: clientPushIds,
            title: notifTitle,
            message: notifMessage,
            url: "/gestante/comunidade",
            tag: `forum-post-${postId}`,
            type: "community",
            priority: "normal",
            target_device: targetDevices.join(","),
          },
        });
      }
    }

    const totalPush = adminUserIds.length + (isDoulasOnly ? 0 : clientUserIds.filter((id: string) => clientOrgMap.has(id)).length);

    return new Response(
      JSON.stringify({
        success: true,
        adminsNotified: adminOrgMap.size,
        clientsNotified: isDoulasOnly ? 0 : clientOrgMap.size,
        pushSent: totalPush,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
