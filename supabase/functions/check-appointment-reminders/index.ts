import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_REMINDER_SETTINGS, describeOffset, getDueReminders, maxLookaheadMinutes,
  type ReminderSettings,
} from "../_shared/agendaReminders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_LOOKAHEAD_MIN = 60 * 24 * 31; // até 30 dias de antecedência + folga

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const now = new Date();

    const { data: settingsRows } = await supabase.from("agenda_reminder_settings").select("*");
    const settingsByOrg = new Map<string, ReminderSettings>();
    for (const row of settingsRows || []) settingsByOrg.set(row.organization_id, row as ReminderSettings);
    const globalLookahead = Math.min(
      MAX_LOOKAHEAD_MIN,
      Math.max(maxLookaheadMinutes(DEFAULT_REMINDER_SETTINGS), ...[...settingsByOrg.values()].map(maxLookaheadMinutes)),
    );

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, title, kind, scheduled_at, created_at, client_id, organization_id, reminder_24h_sent, reminder_1h_sent, clients(full_name, user_id)")
      .is("completed_at", null)
      .not("organization_id", "is", null)
      .gte("scheduled_at", new Date(now.getTime() - 12 * 3_600_000).toISOString())
      .lte("scheduled_at", new Date(now.getTime() + globalLookahead * 60_000).toISOString());
    if (error) throw error;

    const ids = (appointments || []).map((a) => a.id);
    const sentMap = new Map<string, Set<string>>();
    if (ids.length) {
      const { data: logs } = await supabase.from("appointment_reminder_log")
        .select("appointment_id, audience, offset_minutes").in("appointment_id", ids);
      for (const l of logs || []) {
        if (!sentMap.has(l.appointment_id)) sentMap.set(l.appointment_id, new Set());
        sentMap.get(l.appointment_id)!.add(`${l.audience}:${l.offset_minutes}`);
      }
    }

    const adminCache = new Map<string, string[]>();
    const getAdmins = async (orgId: string) => {
      if (adminCache.has(orgId)) return adminCache.get(orgId)!;
      const { data: profiles } = await supabase.from("profiles").select("user_id").eq("organization_id", orgId);
      const userIds = (profiles || []).map((p) => p.user_id);
      let result: string[] = [];
      if (userIds.length) {
        const { data: roles } = await supabase.from("user_roles").select("user_id")
          .in("role", ["admin", "moderator"]).in("user_id", userIds);
        result = [...new Set((roles || []).map((r) => r.user_id))];
      }
      adminCache.set(orgId, result);
      return result;
    };

    let sent = 0;
    const sendPush = async (userIds: string[], title: string, message: string, url: string, tag: string) => {
      if (!userIds.length) return;
      const { error } = await supabase.functions.invoke("send-push-notification", {
        body: { user_ids: userIds, title, message, url, tag, type: "appointment_reminder", priority: "normal" },
      });
      if (error) console.error("[reminders] push error", error); else sent += userIds.length;
    };

    for (const apt of appointments || []) {
      const settings = settingsByOrg.get(apt.organization_id!) ?? DEFAULT_REMINDER_SETTINGS;
      const due = getDueReminders(apt as any, settings, now, sentMap.get(apt.id) ?? new Set());
      if (!due.length) continue;
      const client = apt.clients as any;
      const timeStr = new Date(apt.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const dateStr = new Date(apt.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

      for (const r of due) {
        // Grava antes de enviar para nunca duplicar o aviso.
        const { error: logErr } = await supabase.from("appointment_reminder_log")
          .insert({ appointment_id: apt.id, audience: r.audience, offset_minutes: r.offset_minutes });
        if (logErr) continue;
        const when = describeOffset(r.offset_minutes);

        if (apt.kind === "birthday") {
          const msg = r.offset_minutes === 0
            ? `Hoje: ${apt.title}! Que tal mandar um carinho para ${client?.full_name || "a família"}? 💛`
            : `${apt.title} ${when} (${dateStr}). Prepare um carinho para ${client?.full_name || "a família"} 💛`;
          await sendPush(await getAdmins(apt.organization_id!), "🎂 Aniversário de 1 aninho", msg, "/agenda", `bday-${apt.id}-${r.offset_minutes}`);
          await supabase.from("org_notifications").insert({
            organization_id: apt.organization_id, title: "🎂 Aniversário de 1 aninho", message: msg, type: "appointment_reminder",
          });
        } else if (r.audience === "client" && client?.user_id) {
          await sendPush([client.user_id], "📅 Lembrete de Consulta",
            `Sua consulta "${apt.title}" é ${when} — ${dateStr} às ${timeStr}`, "/gestante/consultas", `apt-c-${apt.id}-${r.offset_minutes}`);
        } else if (r.audience === "doula") {
          const isPersonal = !apt.client_id;
          const body = isPersonal
            ? `Compromisso "${apt.title}" ${when} — ${dateStr} às ${timeStr}`
            : `"${apt.title}" com ${client?.full_name || "cliente"} ${when} — ${dateStr} às ${timeStr}`;
          await sendPush(await getAdmins(apt.organization_id!), isPersonal ? "📋 Lembrete de Compromisso" : "📅 Lembrete de Consulta",
            body, "/agenda", `apt-d-${apt.id}-${r.offset_minutes}`);
        }
      }
    }

    return new Response(JSON.stringify({ sent, checked: appointments?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
