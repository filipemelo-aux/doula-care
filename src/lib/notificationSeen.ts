type SeenMap = Record<string, string>;

function readSeenMap(storageKey: string): SeenMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenMap(storageKey: string, value: SeenMap) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {}
}

export function getNotificationSeenAt(storageKey: string, section: string): string | null {
  const seenMap = readSeenMap(storageKey);
  return seenMap[section] || null;
}

export function markNotificationSeen(
  storageKey: string,
  section: string,
  seenAt = new Date().toISOString()
) {
  const seenMap = readSeenMap(storageKey);
  seenMap[section] = seenAt;
  writeSeenMap(storageKey, seenMap);
  return seenAt;
}

export function getGestanteNotificationSeenKey(clientId: string) {
  return `gestante-notification-seen:${clientId}`;
}

export function getAdminNotificationSeenKey(organizationId: string) {
  return `admin-notification-seen:${organizationId}`;
}
