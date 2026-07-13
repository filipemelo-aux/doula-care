export function sortAppointmentsWithFutureFirst<
  T extends { scheduled_at: string; completed_at?: string | null }
>(appointments: T[]): T[] {
  // Strict chronological order (ascending by scheduled date/time).
  return [...appointments].sort((a, b) => {
    const aTime = new Date(a.scheduled_at).getTime();
    const bTime = new Date(b.scheduled_at).getTime();
    return aTime - bTime;
  });
}

