import { useState, useEffect } from "react";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { TopPlansCard } from "@/components/dashboard/TopPlansCard";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { PeriodFilter, PeriodOption } from "@/components/dashboard/PeriodFilter";
import { ClientsListDialog } from "@/components/dashboard/ClientsListDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Users, Baby, UserRound, ChevronRight } from "lucide-react";
import { AdminWelcomeDialog } from "@/components/dashboard/AdminWelcomeDialog";
import { BillingAlertBanner } from "@/components/dashboard/BillingAlertBanner";
import { PromoBetaBanner } from "@/components/dashboard/PromoBetaBanner";
import { MatchRequestsCard } from "@/components/dashboard/MatchRequestsCard";
import { ClientsOverview } from "@/components/dashboard/ClientsOverview";


export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [gestantesDialogOpen, setGestantesDialogOpen] = useState(false);
  const [puerperasDialogOpen, setPuerperasDialogOpen] = useState(false);
  const [outrosDialogOpen, setOutrosDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const { profileName, user, role } = useAuth();
  const canSeeFinancials = role !== "moderator";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, welcome_seen")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAvatarUrl(data?.avatar_url || null);
        if (data && !(data as any).welcome_seen) {
          setShowWelcome(true);
        }
      });
  }, [user]);

  const { data: metrics } = useFinancialMetrics(period);

  return (
    <div className="space-y-6 lg:space-y-8 overflow-x-hidden">
      {/* Greeting */}
      {profileName && (
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 shadow-md">
            <AvatarImage src={avatarUrl || undefined} alt="Perfil" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="font-display font-bold text-base">{profileName.split(" ")[0]}!</h1>
          </div>
        </div>
      )}

      <PromoBetaBanner />
      <BillingAlertBanner />
      <MatchRequestsCard />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-description">
            Acompanhe suas clientes e o desempenho do seu negócio
          </p>
        </div>
        {canSeeFinancials && <PeriodFilter selected={period} onChange={setPeriod} />}
      </div>

      {/* ═══ 1 — Suas clientes (foco doula) ═══ */}
      <ClientsOverview />

      {/* ═══ 2 — Financeiro (oculto para moderadores) ═══ */}
      {canSeeFinancials && <FinancialOverview period={period} />}

      {/* ═══ 3 — Compromissos ═══ */}
      <UpcomingAppointments />

      {/* ═══ 3 — Clientes ═══ */}
      <div className="rounded-2xl bg-card p-4 lg:p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">Clientes</h2>
          <span className="ml-auto text-2xl font-bold text-foreground">{metrics?.totalClients || 0}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ClientPill
            icon={Baby}
            label="Gestantes"
            value={metrics?.gestantes || 0}
            onClick={() => setGestantesDialogOpen(true)}
          />
          <ClientPill
            icon={Heart}
            label="Puérperas"
            value={metrics?.puerperas || 0}
            onClick={() => setPuerperasDialogOpen(true)}
          />
          <ClientPill
            icon={UserRound}
            label="Outros"
            value={metrics?.outros || 0}
            onClick={() => setOutrosDialogOpen(true)}
          />
        </div>
      </div>

      {/* ═══ 4 — Planos mais contratados (oculto para moderadores — dado agregado financeiro) ═══ */}
      {canSeeFinancials && <TopPlansCard />}

      {/* Dialogs */}
      <ClientsListDialog open={gestantesDialogOpen} onOpenChange={setGestantesDialogOpen} status="gestante" />
      <ClientsListDialog open={puerperasDialogOpen} onOpenChange={setPuerperasDialogOpen} status="lactante" />
      <ClientsListDialog open={outrosDialogOpen} onOpenChange={setOutrosDialogOpen} status="outro" />
      <AdminWelcomeDialog
        open={showWelcome}
        onClose={() => {
          setShowWelcome(false);
          if (user) {
            supabase
              .from("profiles")
              .update({ welcome_seen: true } as any)
              .eq("user_id", user.id)
              .then();
          }
        }}
        name={profileName}
      />
    </div>
  );
}

/* ── Inline sub-components ── */

function ClientPill({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl bg-muted/50 hover:bg-muted p-3 text-left transition-all hover:shadow-sm active:scale-[0.97] space-y-1 cursor-pointer"
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[10px] lg:text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-lg lg:text-xl font-bold text-foreground">{value}</p>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
