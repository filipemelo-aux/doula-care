import { describe, expect, it } from "vitest";
import { countsTowardsClientLimit, getAccessiblePregnancyIds, type PregnancyAccessClient } from "@/lib/clientPlanAccess";

const pregnancy = (id: string, dpp: string | null): PregnancyAccessClient => ({
  id, dpp, status: "gestante", birth_occurred: false, is_visitor: false,
});

describe("pregnancy access by DPP", () => {
  const clients = [pregnancy("later", "2026-12-01"), pregnancy("urgent", "2026-10-17"), pregnancy("unknown", null)];

  it("keeps the nearest DPP accessible regardless of list order and search", () => {
    const accessible = getAccessiblePregnancyIds(clients, 1);
    expect([...accessible]).toEqual(["urgent"]);
    const searched = clients.filter((client) => client.id === "later");
    expect(accessible.has(searched[0].id)).toBe(false);
    expect([...getAccessiblePregnancyIds([...clients].reverse(), 1)]).toEqual(["urgent"]);
  });

  it("prioritizes overdue pregnancies until birth is recorded", () => {
    expect([...getAccessiblePregnancyIds([...clients, pregnancy("overdue", "2026-10-10")], 1)]).toEqual(["overdue"]);
  });

  it("excludes postpartum, occasional and visitor clients from the limit", () => {
    const excluded = [
      { ...pregnancy("postpartum", "2026-09-01"), birth_occurred: true },
      { ...pregnancy("lactante", "2026-09-01"), status: "lactante" },
      { ...pregnancy("occasional", "2026-09-01"), status: "outro" },
      { ...pregnancy("visitor", "2026-09-01"), is_visitor: true },
    ];
    expect(excluded.every((client) => !countsTowardsClientLimit(client))).toBe(true);
    expect([...getAccessiblePregnancyIds([...excluded, ...clients], 1)]).toEqual(["urgent"]);
  });

  it("uses a stable tie-breaker and puts missing DPP last", () => {
    expect([...getAccessiblePregnancyIds([pregnancy("b", "2026-10-17"), pregnancy("a", "2026-10-17"), pregnancy("c", null)], 1)]).toEqual(["a"]);
    expect(getAccessiblePregnancyIds(clients, null).size).toBe(3);
    expect(getAccessiblePregnancyIds(clients, 0).size).toBe(0);
  });
});