export interface PregnancyAccessClient {
  id: string;
  status: string;
  birth_occurred: boolean | null;
  is_visitor: boolean;
  dpp: string | null;
}

export function countsTowardsClientLimit(client: PregnancyAccessClient): boolean {
  return client.status === "gestante" && !client.birth_occurred && !client.is_visitor;
}

/** Select before filtering the visible list. Overdue pregnancies remain urgent. */
export function getAccessiblePregnancyIds(
  clients: readonly PregnancyAccessClient[],
  maxClients: number | null,
): Set<string> {
  const pregnancies = clients.filter(countsTowardsClientLimit).sort((a, b) => {
    if (a.dpp !== b.dpp) {
      if (!a.dpp) return 1;
      if (!b.dpp) return -1;
      return a.dpp.localeCompare(b.dpp);
    }
    return a.id.localeCompare(b.id);
  });
  return new Set(
    (maxClients === null ? pregnancies : pregnancies.slice(0, Math.max(0, maxClients)))
      .map((client) => client.id),
  );
}