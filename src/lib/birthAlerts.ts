import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  calculateCurrentPregnancyDays,
  calculateCurrentPregnancyWeeks,
  isPostTerm,
} from "@/lib/pregnancy";

type Client = Tables<"clients">;
type ContractionSnapshot = Pick<
  Tables<"contractions">,
  "client_id" | "started_at" | "ended_at" | "duration_seconds"
>;

export interface BirthAlertClient extends Client {
  current_weeks: number | null;
  current_days: number;
  is_post_term: boolean;
  is_in_labor: boolean;
  has_ongoing_contraction: boolean;
  recent_contractions_10m: number;
  latest_contraction_at: string | null;
}

const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE_LABOR_WINDOW_MS = 10 * 60 * 1000;

export function getBirthAlertTimestamp(
  client: Pick<BirthAlertClient, "labor_started_at" | "latest_contraction_at" | "updated_at">,
) {
  return client.labor_started_at ?? client.latest_contraction_at ?? client.updated_at;
}

export function buildBirthAlertClients(
  clients: Client[],
  contractions: ContractionSnapshot[],
): BirthAlertClient[] {
  const contractionsByClient = new Map<string, ContractionSnapshot[]>();

  contractions.forEach((contraction) => {
    const list = contractionsByClient.get(contraction.client_id) ?? [];
    list.push(contraction);
    contractionsByClient.set(contraction.client_id, list);
  });

  const activeLaborThreshold = Date.now() - ACTIVE_LABOR_WINDOW_MS;

  return clients
    .map((client) => {
      const clientContractions = contractionsByClient.get(client.id) ?? [];
      const latestContractionAt = clientContractions[0]?.started_at ?? null;
      const hasOngoingContraction = clientContractions.some((contraction) => !contraction.ended_at);
      const recentContractions10m = clientContractions.filter((contraction) => {
        const startedAt = new Date(contraction.started_at).getTime();
        return (
          startedAt >= activeLaborThreshold &&
          ((contraction.duration_seconds ?? 0) >= 60 || !contraction.ended_at)
        );
      }).length;

      const current_weeks = calculateCurrentPregnancyWeeks(
        client.pregnancy_weeks,
        client.pregnancy_weeks_set_at,
        client.dpp,
      );
      const current_days = calculateCurrentPregnancyDays(client.dpp);
      const is_post_term = isPostTerm(client.dpp);
      const is_in_labor = Boolean(client.labor_started_at) || hasOngoingContraction || recentContractions10m >= 3;

      return {
        ...client,
        current_weeks,
        current_days,
        is_post_term,
        is_in_labor,
        has_ongoing_contraction: hasOngoingContraction,
        recent_contractions_10m: recentContractions10m,
        latest_contraction_at: latestContractionAt,
      };
    })
    .filter((client) => client.is_in_labor || (client.current_weeks !== null && client.current_weeks >= 37))
    .sort((a, b) => {
      if (a.is_in_labor && !b.is_in_labor) return -1;
      if (!a.is_in_labor && b.is_in_labor) return 1;
      if (a.has_ongoing_contraction && !b.has_ongoing_contraction) return -1;
      if (!a.has_ongoing_contraction && b.has_ongoing_contraction) return 1;
      if (a.is_post_term && !b.is_post_term) return -1;
      if (!a.is_post_term && b.is_post_term) return 1;

      const timeDiff =
        new Date(getBirthAlertTimestamp(b)).getTime() - new Date(getBirthAlertTimestamp(a)).getTime();
      if (timeDiff !== 0) return timeDiff;

      return (b.current_weeks ?? 0) - (a.current_weeks ?? 0);
    });
}

export async function fetchBirthAlertClients() {
  const since = new Date(Date.now() - DAY_WINDOW_MS).toISOString();

  const [{ data: clients, error: clientsError }, { data: contractions, error: contractionsError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("status", "gestante")
        .or("birth_occurred.is.null,birth_occurred.eq.false")
        .order("pregnancy_weeks", { ascending: false }),
      supabase
        .from("contractions")
        .select("client_id, started_at, ended_at, duration_seconds")
        .gte("started_at", since)
        .order("started_at", { ascending: false }),
    ]);

  if (clientsError) throw clientsError;
  if (contractionsError) throw contractionsError;

  return buildBirthAlertClients(
    (clients ?? []) as Client[],
    (contractions ?? []) as ContractionSnapshot[],
  );
}
