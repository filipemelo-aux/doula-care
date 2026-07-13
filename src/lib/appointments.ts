export function sortAppointmentsWithFutureFirst<
  T extends { scheduled_at: string; completed_at?: string | null }
>(appointments: T[]): T[] {
  const now = Date.now();
  return [...appointments].sort((a, b) => {
    const aTime = new Date(a.scheduled_at).getTime();
    const bTime = new Date(b.scheduled_at).getTime();
    const aIsFuture = aTime >= now && !a.completed_at;
    const bIsFuture = bTime >= now && !b.completed_at;

    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;

    // Both future: nearest first
    if (aIsFuture && bIsFuture) return aTime - bTime;

    // Past/completed: most recent first
    return bTime - aTime;
  });
}
