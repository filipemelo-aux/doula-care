import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_SETTINGS as D, getDueReminders } from "../../supabase/functions/_shared/agendaReminders";

const base = { id: "a", kind: "regular", client_id: "c", scheduled_at: "2026-10-30T12:00:00Z", created_at: "2026-10-01T00:00:00Z" };
const at = (iso: string) => new Date(iso);

describe("Lembretes personalizados", () => {
  it("avisa a doula 3 dias antes quando ela escolhe 3 dias", () => {
    const s = { ...D, doula_offsets_minutes: [4320], client_offsets_minutes: [] };
    expect(getDueReminders(base, s, at("2026-10-27T12:05:00Z"), new Set())).toEqual([{ audience: "doula", offset_minutes: 4320 }]);
  });
  it("não repete um lembrete já enviado", () => {
    const s = { ...D, doula_offsets_minutes: [4320], client_offsets_minutes: [] };
    expect(getDueReminders(base, s, at("2026-10-27T12:05:00Z"), new Set(["doula:4320"]))).toEqual([]);
  });
  it("não envia lembrete para a cliente quando desativado", () => {
    const s = { ...D, client_reminders_enabled: false, doula_offsets_minutes: [] };
    expect(getDueReminders(base, s, at("2026-10-30T11:30:00Z"), new Set())).toEqual([]);
  });
  it("aniversário de 1 aninho avisa 7 dias antes", () => {
    const bday = { ...base, kind: "birthday" };
    expect(getDueReminders(bday, { ...D, birthday_advance_days: [7] }, at("2026-10-23T12:01:00Z"), new Set()))
      .toEqual([{ audience: "doula", offset_minutes: 10080 }]);
  });
  it("aniversário desativado não gera aviso", () => {
    const bday = { ...base, kind: "birthday" };
    expect(getDueReminders(bday, { ...D, birthday_enabled: false }, at("2026-10-30T12:01:00Z"), new Set())).toEqual([]);
  });
});
