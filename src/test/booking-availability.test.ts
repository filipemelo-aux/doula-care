import { describe, expect, it } from "vitest";
import { collectOccupiedSlots, type BookingSources } from "@/lib/bookingAvailability";
import { getAdminBannerDestination } from "@/lib/notificationDestination";

const request = { id: "larissa", requested_date: "2026-10-24", requested_time: "09:00:00" };
const sources: BookingSources = { appointments: [], services: [], requests: [request] };
const slot = "2026-10-24_09:00";

describe("Confirmação de consultas", () => {
  it("não considera a própria solicitação de Larissa um conflito no dia 24/10", () => {
    expect(collectOccupiedSlots(sources, request.id).has(slot)).toBe(false);
  });
  it("mantém a reserva pendente bloqueada para novos agendamentos", () => {
    expect(collectOccupiedSlots(sources).has(slot)).toBe(true);
  });
  it("bloqueia se outra solicitação ocupa o mesmo horário", () => {
    expect(collectOccupiedSlots({ ...sources, requests: [request, { ...request, id: "outra" }] }, request.id).has(slot)).toBe(true);
  });
  it("bloqueia compromisso existente às 09h de São Paulo mesmo excluindo a solicitação", () => {
    expect(collectOccupiedSlots({ ...sources, appointments: [{ scheduled_at: "2026-10-24T12:00:00Z" }] }, request.id).has(slot)).toBe(true);
  });
  it("mantém conflito com serviço aceito", () => {
    expect(collectOccupiedSlots({ ...sources, services: [{ scheduled_date: "2026-10-24T12:00:00Z" }] }, request.id).has(slot)).toBe(true);
  });
  it("não bloqueia outro horário do mesmo dia", () => {
    expect(collectOccupiedSlots({ ...sources, appointments: [{ scheduled_at: "2026-10-24T13:00:00Z" }] }, request.id).has(slot)).toBe(false);
  });
});

describe("Destino do aviso", () => {
  it("leva os detalhes de solicitação de consulta à Agenda", () => {
    expect(getAdminBannerDestination("appointment_request")).toBe("/agenda");
  });
  it("preserva o destino de comunidade", () => {
    expect(getAdminBannerDestination("community")).toBe("/comunidade");
  });
});