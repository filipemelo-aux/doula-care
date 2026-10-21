import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BellRing, Cake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_REMINDER_SETTINGS } from "../../../supabase/functions/_shared/agendaReminders";

const OFFSET_OPTIONS = [
  { v: 15, l: "15 min" }, { v: 30, l: "30 min" }, { v: 60, l: "1 hora" }, { v: 120, l: "2 horas" },
  { v: 180, l: "3 horas" }, { v: 360, l: "6 horas" }, { v: 720, l: "12 horas" }, { v: 1440, l: "1 dia" },
  { v: 2880, l: "2 dias" }, { v: 4320, l: "3 dias" }, { v: 10080, l: "1 semana" },
];
const BIRTHDAY_OPTIONS = [
  { v: 0, l: "No dia" }, { v: 1, l: "1 dia antes" }, { v: 3, l: "3 dias" }, { v: 7, l: "1 semana" },
  { v: 15, l: "15 dias" }, { v: 30, l: "30 dias" },
];

type Settings = {
  doula_offsets_minutes: number[]; client_offsets_minutes: number[];
  doula_reminders_enabled: boolean; client_reminders_enabled: boolean; personal_reminders_enabled: boolean;
  notify_client_on_new_appointment: boolean; notify_on_appointment_request: boolean;
  birthday_enabled: boolean; birthday_advance_days: number[];
};
const DEFAULTS: Settings = { ...DEFAULT_REMINDER_SETTINGS, notify_client_on_new_appointment: true, notify_on_appointment_request: true };

export function useAgendaReminderSettings() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["agenda-reminder-settings", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Settings> => {
      const { data } = await supabase.from("agenda_reminder_settings").select("*").eq("organization_id", organizationId!).maybeSingle();
      return data ? (data as unknown as Settings) : DEFAULTS;
    },
  });
}

function Chips({ options, value, onChange, disabled }: { options: { v: number; l: string }[]; value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-2", disabled && "opacity-50 pointer-events-none")}>
      {options.map((o) => {
        const on = value.includes(o.v);
        return (
          <button key={o.v} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o.v) : [...value, o.v].sort((a, b) => b - a))}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function Row({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AgendaRemindersCard() {
  const { organizationId, role } = useAuth();
  const qc = useQueryClient();
  const { data } = useAgendaReminderSettings();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setS(data); }, [data]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const canEdit = role === "admin";

  const save = async () => {
    if (!organizationId) return;
    setSaving(true);
    const { error } = await supabase.from("agenda_reminder_settings").upsert({ organization_id: organizationId, ...s });
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar os lembretes");
    qc.invalidateQueries({ queryKey: ["agenda-reminder-settings"] });
    toast.success("Lembretes salvos!");
  };

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><BellRing className="w-5 h-5 text-primary" /></div>
          <div><CardTitle className="text-lg">Lembretes da Agenda</CardTitle>
            <CardDescription>Escolha quando você e suas clientes serão avisadas</CardDescription></div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-6", !canEdit && "opacity-60 pointer-events-none")}>
        <section className="space-y-3">
          <Row title="Meus lembretes" desc="Avisos para você e sua equipe antes de cada compromisso" checked={s.doula_reminders_enabled} onChange={(v) => set("doula_reminders_enabled", v)} />
          <Chips options={OFFSET_OPTIONS} value={s.doula_offsets_minutes} onChange={(v) => set("doula_offsets_minutes", v)} disabled={!s.doula_reminders_enabled} />
          <Row title="Incluir compromissos pessoais" desc="Também lembrar compromissos sem cliente" checked={s.personal_reminders_enabled} onChange={(v) => set("personal_reminders_enabled", v)} />
        </section>

        <section className="space-y-3">
          <Row title="Lembretes para a cliente" desc="Avisos enviados à gestante antes das consultas dela" checked={s.client_reminders_enabled} onChange={(v) => set("client_reminders_enabled", v)} />
          <Chips options={OFFSET_OPTIONS} value={s.client_offsets_minutes} onChange={(v) => set("client_offsets_minutes", v)} disabled={!s.client_reminders_enabled} />
          <Row title="Avisar a cliente ao agendar" desc="Notificar na hora quando você marcar uma nova consulta" checked={s.notify_client_on_new_appointment} onChange={(v) => set("notify_client_on_new_appointment", v)} />
          <Row title="Avisar sobre solicitações" desc="Receber aviso quando a cliente pedir uma consulta" checked={s.notify_on_appointment_request} onChange={(v) => set("notify_on_appointment_request", v)} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Cake className="h-4 w-4 text-primary" />Aniversário de 1 aninho</div>
          <Row title="Lembrar do 1º aniversário" desc="Ao registrar o nascimento, criamos um compromisso na Agenda para quando o bebê completar 1 ano" checked={s.birthday_enabled} onChange={(v) => set("birthday_enabled", v)} />
          <p className="text-xs text-muted-foreground">Com quanta antecedência quer ser avisada?</p>
          <Chips options={BIRTHDAY_OPTIONS} value={s.birthday_advance_days} onChange={(v) => set("birthday_advance_days", v)} disabled={!s.birthday_enabled} />
        </section>

        {canEdit && (
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar lembretes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
