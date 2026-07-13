import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Ensures the given date has at least one availability slot for the org.
 * If none exists, inserts a slot covering the appointment hour (HH:00 - HH+1:00).
 * Safe to call after every appointment insert.
 */
export async function ensureAvailabilityForAppointment(
  organizationId: string | null | undefined,
  scheduledAtUtcIso: string
) {
  if (!organizationId) return;
  try {
    const zoned = toZonedTime(new Date(scheduledAtUtcIso), "America/Sao_Paulo");
    const dateStr = format(zoned, "yyyy-MM-dd");
    const hour = zoned.getHours();

    const { data: existing, error: selErr } = await supabase
      .from("doula_availability")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("available_date", dateStr)
      .limit(1);
    if (selErr) return;
    if (existing && existing.length > 0) return;

    const startH = Math.max(0, Math.min(23, hour));
    const endH = Math.min(24, startH + 1);
    await supabase.from("doula_availability").insert({
      organization_id: organizationId,
      available_date: dateStr,
      start_time: `${String(startH).padStart(2, "0")}:00:00`,
      end_time: `${String(endH).padStart(2, "0")}:00:00`,
    });
  } catch {
    // silent - non-critical
  }
}
