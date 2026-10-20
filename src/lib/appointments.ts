/**
 * Ordem cronológica padrão: próximos compromissos primeiro (o mais prestes a
 * acontecer no topo, em ordem crescente), depois os passados do mais recente
 * para o mais antigo.
 */
export function sortAppointmentsWithFutureFirst<
  T extends { scheduled_at: string; completed_at?: string | null }
>(appointments: T[], now: Date = new Date()): T[] {
  const nowMs = now.getTime();
  return [...appointments].sort((a, b) => {
    const aTime = new Date(a.scheduled_at).getTime();
    const bTime = new Date(b.scheduled_at).getTime();
    const aFuture = aTime >= nowMs;
    const bFuture = bTime >= nowMs;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return aFuture ? aTime - bTime : bTime - aTime;
  });
}
