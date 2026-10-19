import { describe, expect, it } from "vitest";
import { canRegisterBirth } from "@/lib/birthRegistration";

describe("Registro de nascimento independente de trabalho de parto", () => {
  it("permite nascimento sem trabalho de parto nem contrações", () => {
    const client = { birth_occurred: false, labor_started_at: null, contractions: [] };
    expect(canRegisterBirth(client)).toBe(true);
  });
  it("permite nascimento quando o início do trabalho de parto foi registrado", () => {
    const client = { birth_occurred: false, labor_started_at: "2026-10-19T22:00:00Z" };
    expect(canRegisterBirth(client)).toBe(true);
  });
  it("permite nascimento para cadastro antigo sem indicador preenchido", () => {
    expect(canRegisterBirth({ birth_occurred: null })).toBe(true);
  });
  it("não oferece novo registro quando o nascimento já ocorreu", () => {
    expect(canRegisterBirth({ birth_occurred: true })).toBe(false);
  });
});