import { describe, it, expect } from "vitest";
import { sortAppointmentsWithFutureFirst } from "@/lib/appointments";

describe("ordem dos compromissos", () => {
  it("mostra o próximo a acontecer primeiro e depois os passados", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const items = [
      { id: "dez", scheduled_at: "2026-12-01T12:00:00Z" },
      { id: "ontem", scheduled_at: "2026-10-19T12:00:00Z" },
      { id: "amanha", scheduled_at: "2026-10-21T12:00:00Z" },
      { id: "setembro", scheduled_at: "2026-09-01T12:00:00Z" },
    ];
    expect(sortAppointmentsWithFutureFirst(items, now).map((i) => i.id)).toEqual(["amanha", "dez", "ontem", "setembro"]);
  });
});
