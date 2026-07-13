export function sortAppointmentsWithFutureFirst<
  T extends { scheduled_at: string; completed_at?: string | null }
>(appointments: T[]): T[] {
  // Newest/upcoming appointments first, then older ones.
  return [...appointments].sort((a, b) => {
    const aTime = new Date(a.scheduled_at).getTime();
    const bTime = new Date(b.scheduled_at).getTime();
    return bTime - aTime;
  });
}

