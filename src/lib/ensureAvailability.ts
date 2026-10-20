/**
 * Antes, criar um compromisso inseria automaticamente uma disponibilidade,
 * o que expunha o horário para as gestantes agendarem. Agora a disponibilidade
 * vem SOMENTE do que a doula cadastra na aba Disponibilidade.
 * Mantido como no-op para não quebrar chamadas existentes.
 */
export async function ensureAvailabilityForAppointment(
  _organizationId: string | null | undefined,
  _scheduledAtUtcIso: string
) {
  return;
}
