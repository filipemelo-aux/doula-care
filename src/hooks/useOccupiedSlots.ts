import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Shared hook that computes ALL occupied time-slots for an organization,
 * considering appointments, accepted service_requests AND pending/approved
 * appointment_requests. This ensures no double-booking across the whole app.
 */
export function useOccupiedSlots(organizationId: string | null) {
  return useQuery({
    queryKey: ["occupied-slots", organizationId],
    queryFn: async () => {
      const today = new Date().toISOString();
      const todayDate = format(new Date(), "yyyy-MM-dd");

      const [aptsRes, srRes, arRes] = await Promise.all([
        // 1. Confirmed appointments (not completed)
        supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("organization_id", organizationId!)
          .gte("scheduled_at", today)
          .is("completed_at", null),
        // 2. Accepted / date_proposed service requests
        supabase
          .from("service_requests")
          .select("scheduled_date")
          .eq("organization_id", organizationId!)
          .in("status", ["accepted", "date_proposed"])
          .not("scheduled_date", "is", null),
        // 3. Pending / approved appointment requests
        supabase
          .from("appointment_requests")
          .select("requested_date, requested_time, status")
          .eq("organization_id", organizationId!)
          .in("status", ["pending", "approved"])
          .gte("requested_date", todayDate),
      ]);

      const occupied: string[] = [];

      (aptsRes.data || []).forEach((a: any) => {
        if (a.scheduled_at) {
          const d = new Date(a.scheduled_at);
          occupied.push(`${format(d, "yyyy-MM-dd")}_${format(d, "HH:mm")}`);
        }
      });

      (srRes.data || []).forEach((s: any) => {
        if (s.scheduled_date) {
          const d = new Date(s.scheduled_date);
          occupied.push(`${format(d, "yyyy-MM-dd")}_${format(d, "HH:mm")}`);
        }
      });

      (arRes.data || []).forEach((r: any) => {
        if (r.requested_date && r.requested_time) {
          const time = r.requested_time.substring(0, 5); // "HH:mm"
          occupied.push(`${r.requested_date}_${time}`);
        }
      });

      return new Set(occupied);
    },
    enabled: !!organizationId,
  });
}
