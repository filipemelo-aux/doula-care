import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { postId, authorId, authorName, postTitle, isAnonymous } = await req.json();

    if (!postId || !authorId || !postTitle) {
      return new Response(
        JSON.stringify({ error: "postId, authorId e postTitle são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const displayAuthor = isAnonymous ? "Anônima" : (authorName || "Alguém");
    const notifTitle = "💬 Nova publicação na Comunidade";
    const notifMessage = `${displayAuthor} publicou: "${postTitle.substring(0, 80)}${postTitle.length > 80 ? "..." : ""}"`;

    // 1. Get all admin/moderator user IDs with their org
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "moderator"]);

    const adminUserIds = (adminRoles || [])
      .map((r: any) => r.user_id)
      .filter((id: string) => id !== authorId);

    // Get org_id for each admin
    const adminOrgMap = new Map<string, string>();
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

    // 2. Get all client user IDs
    const { data: clientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");

    const clientUserIds = (clientRoles || [])
      .map((r: any) => r.user_id)
      .filter((id: string) => id !== authorId);

    // Get client records for these user_ids
    const clientOrgMap = new Map<string, { clientId: string; orgId: string | null }>();
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

    // 4. Insert client_notifications for clients (batched)
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

    // 5. Send push notification to all users (admins + clients)
    const allUserIds = [
      ...adminUserIds,
      ...clientUserIds.filter((id: string) => clientOrgMap.has(id)),
    ];

    if (allUserIds.length > 0) {
      // Call the existing send-push-notification function
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: allUserIds,
          title: notifTitle,
          message: notifMessage,
          url: "/comunidade",
          tag: `forum-post-${postId}`,
          type: "community",
          priority: "normal",
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        adminsNotified: adminOrgMap.size,
        clientsNotified: clientOrgMap.size,
        pushSent: allUserIds.length,
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
