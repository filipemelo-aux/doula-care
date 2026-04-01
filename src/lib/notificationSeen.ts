import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the "seen_at" timestamp for a given storage_key + section from the DB.
 * Returns null if not found.
 */
export async function getNotificationSeenAt(
  storageKey: string,
  section: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("notification_seen")
    .select("seen_at")
    .eq("user_id", userId)
    .eq("storage_key", storageKey)
    .eq("section", section)
    .maybeSingle();

  return data?.seen_at ?? null;
}

/**
 * Upserts the "seen_at" timestamp for a given storage_key + section in the DB.
 * This persists across all devices/logins.
 */
export async function markNotificationSeen(
  storageKey: string,
  section: string,
  userId: string,
  seenAt = new Date().toISOString(),
): Promise<string> {
  await supabase
    .from("notification_seen")
    .upsert(
      {
        user_id: userId,
        storage_key: storageKey,
        section,
        seen_at: seenAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,storage_key,section" },
    );

  return seenAt;
}

export function getGestanteNotificationSeenKey(clientId: string) {
  return `gestante-notification-seen:${clientId}`;
}

export function getAdminNotificationSeenKey(organizationId: string) {
  return `admin-notification-seen:${organizationId}`;
}
