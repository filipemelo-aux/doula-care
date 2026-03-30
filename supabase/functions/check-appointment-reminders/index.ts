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

    const now = new Date();

    // Find appointments needing 24h reminder (between 23h and 25h from now, not yet sent)
    const { data: remind24h } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, client_id, organization_id, clients(full_name, user_id)")
      .eq("reminder_24h_sent", false)
      .is("completed_at", null)
      .gte("scheduled_at", new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString());

    // Find appointments needing 1h reminder (between 30min and 1.5h from now, not yet sent)
    const { data: remind1h } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, client_id, organization_id, clients(full_name, user_id)")
      .eq("reminder_1h_sent", false)
      .is("completed_at", null)
      .gte("scheduled_at", new Date(now.getTime() + 30 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 90 * 60 * 1000).toISOString());

    let sent = 0;

    /**
     * Delegate push sending to the send-push-notification edge function.
     * This ensures FCM (Capacitor native) tokens are handled correctly
     * alongside web push (VAPID) subscriptions.
     */
    const sendPush = async (userIds: string[], title: string, body: string, url: string, tag: string) => {
      if (userIds.length === 0) return;

      try {
        const { error } = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: userIds,
            title,
            message: body,
            url,
            tag,
            type: "appointment_reminder",
            priority: "normal",
          },
        });

        if (error) {
          console.error("[reminders] send-push-notification error:", error);
        } else {
          sent += userIds.length;
        }
      } catch (err) {
        console.error("[reminders] Failed to invoke send-push-notification:", err);
      }
    };

    const getAdminUserIds = async (orgId: string): Promise<string[]> => {
      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId);

      if (!orgProfiles || orgProfiles.length === 0) return [];

      const orgUserIds = orgProfiles.map(p => p.user_id);
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"])
        .in("user_id", orgUserIds);

      return adminRoles?.map(r => r.user_id) || [];
    };

    // Process 24h reminders
    if (remind24h && remind24h.length > 0) {
      for (const apt of remind24h) {
        const client = apt.clients as any;
        const isPersonal = !apt.client_id;
        const scheduledDate = new Date(apt.scheduled_at);
        const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // Notify the client (only for client appointments)
        if (!isPersonal && client?.user_id) {
          await sendPush(
            [client.user_id],
            "📅 Lembrete de Consulta",
            `Sua consulta "${apt.title}" é amanhã às ${timeStr}`,
            "/gestante",
            `apt-24h-${apt.id}`
          );
        }

        // Notify admins IN THE SAME ORGANIZATION as the appointment
        if (apt.organization_id) {
          const adminUserIds = await getAdminUserIds(apt.organization_id);
          if (adminUserIds.length > 0) {
            const bodyText = isPersonal
              ? `Compromisso pessoal "${apt.title}" é amanhã às ${timeStr}`
              : `"${apt.title}" com ${client?.full_name || "cliente"} às ${timeStr}`;

            await sendPush(
              adminUserIds,
              isPersonal ? "📋 Compromisso Amanhã" : "📅 Consulta Amanhã",
              bodyText,
              "/agenda",
              `apt-admin-24h-${apt.id}`
            );
          }
        }

        // Mark as sent
        await supabase.from("appointments").update({ reminder_24h_sent: true }).eq("id", apt.id);
      }
    }

    // Process 1h reminders
    if (remind1h && remind1h.length > 0) {
      for (const apt of remind1h) {
        const client = apt.clients as any;
        const isPersonal = !apt.client_id;
        const scheduledDate = new Date(apt.scheduled_at);
        const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // Notify the client (only for client appointments)
        if (!isPersonal && client?.user_id) {
          await sendPush(
            [client.user_id],
            "⏰ Consulta em 1 hora!",
            `"${apt.title}" às ${timeStr}`,
            "/gestante",
            `apt-1h-${apt.id}`
          );
        }

        // Notify admins IN THE SAME ORGANIZATION as the appointment
        if (apt.organization_id) {
          const adminUserIds = await getAdminUserIds(apt.organization_id);
          if (adminUserIds.length > 0) {
            const bodyText = isPersonal
              ? `Compromisso pessoal "${apt.title}" às ${timeStr}`
              : `"${apt.title}" com ${client?.full_name || "cliente"} às ${timeStr}`;

            await sendPush(
              adminUserIds,
              isPersonal ? "⏰ Compromisso em 1 hora!" : "⏰ Consulta em 1 hora!",
              bodyText,
              "/agenda",
              `apt-admin-1h-${apt.id}`
            );
          }
        }

        await supabase.from("appointments").update({ reminder_1h_sent: true }).eq("id", apt.id);
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        reminders_24h: remind24h?.length || 0,
        reminders_1h: remind1h?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
