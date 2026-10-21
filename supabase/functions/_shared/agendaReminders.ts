// Pure reminder scheduling rules shared by the edge function and tests.
export interface ReminderSettings {
  doula_offsets_minutes: number[];
  client_offsets_minutes: number[];
  doula_reminders_enabled: boolean;
  client_reminders_enabled: boolean;
  personal_reminders_enabled: boolean;
  birthday_enabled: boolean;
  birthday_advance_days: number[];
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  doula_offsets_minutes: [1440, 60],
  client_offsets_minutes: [1440, 60],
  doula_reminders_enabled: true,
  client_reminders_enabled: true,
  personal_reminders_enabled: true,
  birthday_enabled: true,
  birthday_advance_days: [7, 0],
};

export interface ReminderAppointment {
  id: string;
  kind: string;
  client_id: string | null;
  scheduled_at: string;
  created_at: string;
  reminder_24h_sent?: boolean;
  reminder_1h_sent?: boolean;
}

export type Audience = "doula" | "client";
export interface DueReminder { audience: Audience; offset_minutes: number }

/** Birthday reminders fire at 09:00 São Paulo on the chosen day, i.e. offset in whole days. */
export function getDueReminders(
  apt: ReminderAppointment,
  settings: ReminderSettings,
  now: Date,
  alreadySent: Set<string>,
): DueReminder[] {
  const at = new Date(apt.scheduled_at).getTime();
  const created = new Date(apt.created_at).getTime();
  const nowMs = now.getTime();
  const due: DueReminder[] = [];

  const consider = (audience: Audience, offset: number) => {
    const target = at - offset * 60_000;
    if (nowMs < target) return; // ainda não chegou a hora
    if (offset > 0 && nowMs >= at) return; // compromisso já passou
    if (offset === 0 && nowMs > at + 12 * 3_600_000) return; // aviso "no dia" vale até 12h depois
    if (target < created - 60_000) return; // lembrete anterior à criação do compromisso
    if (alreadySent.has(`${audience}:${offset}`)) return;
    if (offset === 1440 && apt.reminder_24h_sent) return;
    if (offset === 60 && apt.reminder_1h_sent) return;
    due.push({ audience, offset_minutes: offset });
  };

  if (apt.kind === "birthday") {
    if (!settings.birthday_enabled) return [];
    for (const days of settings.birthday_advance_days) consider("doula", days * 1440);
    return due;
  }

  const isPersonal = !apt.client_id;
  if (settings.doula_reminders_enabled && (!isPersonal || settings.personal_reminders_enabled)) {
    for (const o of settings.doula_offsets_minutes) consider("doula", o);
  }
  if (!isPersonal && settings.client_reminders_enabled) {
    for (const o of settings.client_offsets_minutes) consider("client", o);
  }
  return due;
}

export function maxLookaheadMinutes(settings: ReminderSettings) {
  return Math.max(
    60,
    ...settings.doula_offsets_minutes,
    ...settings.client_offsets_minutes,
    ...settings.birthday_advance_days.map((d) => d * 1440),
  );
}

export function describeOffset(minutes: number) {
  if (minutes === 0) return "hoje";
  if (minutes % 10080 === 0) { const w = minutes / 10080; return w === 1 ? "em 1 semana" : `em ${w} semanas`; }
  if (minutes % 1440 === 0) { const d = minutes / 1440; return d === 1 ? "amanhã" : `em ${d} dias`; }
  if (minutes % 60 === 0) { const h = minutes / 60; return h === 1 ? "em 1 hora" : `em ${h} horas`; }
  return `em ${minutes} minutos`;
}
