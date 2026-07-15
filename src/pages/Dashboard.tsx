import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { TopPlansCard } from "@/components/dashboard/TopPlansCard";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { CalendarLabelsSummaryCard } from "@/components/dashboard/CalendarLabelsSummaryCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart } from "lucide-react";
import { AdminWelcomeDialog } from "@/components/dashboard/AdminWelcomeDialog";
import { BillingAlertBanner } from "@/components/dashboard/BillingAlertBanner";
import { PromoBetaBanner } from "@/components/dashboard/PromoBetaBanner";
import { MatchRequestsCard } from "@/components/dashboard/MatchRequestsCard";
import { ModeratorPaymentRequestsCard } from "@/components/dashboard/ModeratorPaymentRequestsCard";
import { ClientsOverview } from "@/components/dashboard/ClientsOverview";



export default function Dashboard() {
  
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
          // Persist immediately so it never appears again on any device,
          // regardless of whether the user actually closes the dialog.
          supabase
            .from("profiles")
            .update({ welcome_seen: true } as any)
            .eq("user_id", user.id)
            .then(() => {});
        }
      });
  }, [user]);

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
      <ModeratorPaymentRequestsCard />


      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-description">
            Acompanhe suas clientes e o desempenho do seu negócio
          </p>
        </div>
      </div>

      {/* ═══ 1 — Suas clientes (foco doula) ═══ */}
      <ClientsOverview />

      {/* ═══ 2 — Compromissos ═══ */}
      <UpcomingAppointments />
      <CalendarLabelsSummaryCard />

      {/* ═══ 3 — Financeiro (oculto para moderadores) ═══ */}
      {canSeeFinancials && <FinancialOverview />}

      {/* ═══ 4 — Planos mais contratados (oculto para moderadores — dado agregado financeiro) ═══ */}
      {canSeeFinancials && <TopPlansCard />}

      {/* Dialogs */}
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

