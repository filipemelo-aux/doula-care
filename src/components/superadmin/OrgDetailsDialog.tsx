import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Instagram,
  GraduationCap,
  CalendarDays,
  IdCard,
  Users,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatPhone } from "@/lib/masks";

interface Props {
  orgId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (value?: string | null, withTime = false) => {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, withTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", { locale: ptBR });
};

const Row = ({
  icon: Icon,
  label,
  value,
}: {
  icon?: any;
  label: string;
  value?: string | null;
}) => (
  <div className="flex items-start gap-2 py-1.5">
    {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /> : <span className="w-3.5" />}
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value?.trim() ? value : "—"}</p>
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-muted/40 p-3">
    <p className="text-xs font-semibold text-foreground mb-1">{title}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">{children}</div>
  </div>
);

export function OrgDetailsDialog({ orgId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-org-details", orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const [{ data: org }, { data: profiles }, { data: personal }, { count: clientCount }] =
        await Promise.all([
          supabase.from("organizations").select("*").eq("id", orgId!).maybeSingle(),
          supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, created_at, lgpd_consent_at, lgpd_consent_version, profile_completed_at")
            .eq("organization_id", orgId!),
          supabase
            .from("doula_personal_data")
            .select("user_id, cpf, birth_date")
            .eq("organization_id", orgId!),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId!),
        ]);

      const userIds = (profiles || []).map((p: any) => p.user_id);
      let roles: any[] = [];
      if (userIds.length) {
        const { data: r } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        roles = r || [];
      }

      return { org, profiles: profiles || [], personal: personal || [], roles, clientCount: clientCount || 0 };
    },
  });

  const org: any = data?.org;
  const owner: any =
    data?.profiles.find((p: any) =>
      data.roles.some((r: any) => r.user_id === p.user_id && r.role === "admin")
    ) || data?.profiles?.[0];
  const ownerPersonal: any =
    data?.personal.find((p: any) => p.user_id === owner?.user_id) || data?.personal?.[0];

  const team = (data?.profiles || []).map((p: any) => ({
    ...p,
    role: data?.roles.find((r: any) => r.user_id === p.user_id)?.role || "—",
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            {org?.nome_exibicao?.trim() || org?.name || "Cadastro da doula"}
          </DialogTitle>
          <DialogDescription>Cadastro completo da doula e da organização</DialogDescription>
        </DialogHeader>

        {isLoading || !org ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">{org.plan}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase">{org.status}</Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Users className="h-3 w-3" />
                {data?.clientCount} cliente{data?.clientCount === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {org.accepts_new_clients ? "Aceita novas clientes" : "Não aceita novas clientes"}
              </Badge>
            </div>

            <Section title="Identificação">
              <Row icon={Building2} label="Nome / Razão" value={org.name} />
              <Row icon={Building2} label="Nome de exibição" value={org.nome_exibicao} />
              <Row icon={Mail} label="E-mail responsável" value={org.responsible_email} />
              <Row icon={CalendarDays} label="Cadastrada em" value={fmtDate(org.created_at, true)} />
            </Section>

            <Section title="Dados pessoais da doula">
              <Row icon={IdCard} label="Nome completo" value={owner?.full_name} />
              <Row icon={IdCard} label="CPF" value={ownerPersonal?.cpf ? formatCPF(ownerPersonal.cpf) : null} />
              <Row icon={CalendarDays} label="Data de nascimento" value={fmtDate(ownerPersonal?.birth_date)} />
              <Row
                icon={ShieldCheck}
                label="Consentimento LGPD"
                value={
                  owner?.lgpd_consent_at
                    ? `${fmtDate(owner.lgpd_consent_at, true)} (${owner.lgpd_consent_version || "—"})`
                    : "Não registrado"
                }
              />
              <Row
                icon={ShieldCheck}
                label="Cadastro completo"
                value={owner?.profile_completed_at ? fmtDate(owner.profile_completed_at, true) : "Pendente"}
              />
            </Section>

            <Section title="Contato">
              <Row icon={Phone} label="WhatsApp" value={org.whatsapp ? formatPhone(org.whatsapp) : null} />
              <Row icon={Instagram} label="Instagram" value={org.instagram ? `@${String(org.instagram).replace(/^@/, "")}` : null} />
            </Section>

            <Section title="Endereço e atuação">
              <Row icon={MapPin} label="CEP" value={org.postal_code} />
              <Row icon={MapPin} label="Rua / Número" value={[org.street, org.street_number].filter(Boolean).join(", ")} />
              <Row icon={MapPin} label="Bairro" value={org.neighborhood} />
              <Row icon={MapPin} label="Cidade / UF" value={[org.city, org.state].filter(Boolean).join(" / ")} />
              <Row icon={MapPin} label="Áreas de atendimento" value={(org.service_areas || []).join(", ")} />
              <Row
                icon={MapPin}
                label="Coordenadas"
                value={org.latitude && org.longitude ? `${org.latitude}, ${org.longitude}` : null}
              />
            </Section>

            <Section title="Perfil profissional">
              <Row icon={GraduationCap} label="Formação" value={org.doula_training} />
              <Row icon={CalendarDays} label="Atua desde" value={org.practice_since ? String(org.practice_since) : null} />
            </Section>

            {org.bio ? (
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-xs font-semibold text-foreground mb-1">Bio</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{org.bio}</p>
              </div>
            ) : null}

            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">Equipe ({team.length})</p>
              <div className="space-y-1.5">
                {team.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
                {team.map((m: any) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground truncate">{m.full_name || "Sem nome"}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{m.role}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground mb-1">Assinatura e cobrança</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Row label="Ciclo de cobrança" value={org.billing_cycle} />
                <Row label="Próxima cobrança" value={fmtDate(org.next_billing_date)} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
