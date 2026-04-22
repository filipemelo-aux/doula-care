// Lightweight local-only storage for anonymous "visitante" users.
// Allows browsing the visitor area without an account.
// Data lives in localStorage and is migrated/abandoned once the user signs up.

const KEY_PROFILE = "guest_visitor_profile_v1";
const KEY_CONTRACTIONS = "guest_visitor_contractions_v1";
const KEY_DIARY = "guest_visitor_diary_v1";

export interface GuestProfile {
  preferred_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  dpp?: string | null;
  /** True once the welcome dialog has been shown/answered. */
  _welcomed?: boolean;
}

export interface GuestContraction {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface GuestDiaryEntry {
  id: string;
  content: string;
  emotion: string | null;
  symptoms: string[] | null;
  observations: string | null;
  created_at: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

// Profile
export const getGuestProfile = (): GuestProfile => read<GuestProfile>(KEY_PROFILE, {});
export const setGuestProfile = (p: GuestProfile) => write(KEY_PROFILE, p);

// Contractions
export const getGuestContractions = (): GuestContraction[] =>
  read<GuestContraction[]>(KEY_CONTRACTIONS, []);
export const setGuestContractions = (list: GuestContraction[]) =>
  write(KEY_CONTRACTIONS, list);

// Diary
export const getGuestDiary = (): GuestDiaryEntry[] =>
  read<GuestDiaryEntry[]>(KEY_DIARY, []);
export const setGuestDiary = (list: GuestDiaryEntry[]) => write(KEY_DIARY, list);

export function clearGuestData() {
  try {
    localStorage.removeItem(KEY_PROFILE);
    localStorage.removeItem(KEY_CONTRACTIONS);
    localStorage.removeItem(KEY_DIARY);
  } catch { /* noop */ }
}
