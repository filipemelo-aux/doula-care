import { useQuery } from "@tanstack/react-query";
import { fetchOccupiedSlots } from "@/lib/bookingAvailability";

/**
 * Shared hook that computes ALL occupied time-slots for an organization,
 * considering appointments, accepted service_requests AND pending/approved
 * appointment_requests. This ensures no double-booking across the whole app.
 */
export function useOccupiedSlots(organizationId: string | null) {
  return useQuery({
    queryKey: ["occupied-slots", organizationId],
    queryFn: async () => {
      if (!organizationId) return new Set<string>();
      return fetchOccupiedSlots(organizationId);
    },
    enabled: !!organizationId,
  });
}
