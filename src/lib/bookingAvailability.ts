import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";

const TIME_ZONE = "America/Sao_Paulo";

export interface BookingSources {
  appointments: { scheduled_at: string }[];
  services: { scheduled_date: string | null }[];
  requests: { id: string; requested_date: string; requested_time: string }[];
}

export function collectOccupiedSlots(sources: BookingSources, excludedRequestId?: string) {
  const slots = new Set<string>();
  for (const appointment of sources.appointments) {
    slots.add(formatInTimeZone(appointment.scheduled_at, TIME_ZONE, "yyyy-MM-dd_HH:mm"));
  }
  for (const service of sources.services) {
    if (service.scheduled_date) {
      slots.add(formatInTimeZone(service.scheduled_date, TIME_ZONE, "yyyy-MM-dd_HH:mm"));
    }
  }
  for (const request of sources.requests) {
    if (request.id !== excludedRequestId) {
      slots.add(`${request.requested_date}_${request.requested_time.slice(0, 5)}`);
    }
  }
  return slots;
}

export async function fetchOccupiedSlots(organizationId: string, excludedRequestId?: string) {
  const now = new Date();
  const [appointments, services, requests] = await Promise.all([
    supabase.from("appointments").select("scheduled_at").neq("kind", "birthday")
      .eq("organization_id", organizationId).gte("scheduled_at", now.toISOString()).is("completed_at", null),
    supabase.from("service_requests").select("scheduled_date")
      .eq("organization_id", organizationId).in("status", ["accepted", "date_proposed"]).not("scheduled_date", "is", null),
    supabase.from("appointment_requests").select("id, requested_date, requested_time")
      .eq("organization_id", organizationId).in("status", ["pending", "approved"])
      .gte("requested_date", formatInTimeZone(now, TIME_ZONE, "yyyy-MM-dd")),
  ]);
  for (const result of [appointments, services, requests]) {
    if (result.error) throw result.error;
  }
  return collectOccupiedSlots({
    appointments: appointments.data || [],
    services: services.data || [],
    requests: requests.data || [],
  }, excludedRequestId);
}