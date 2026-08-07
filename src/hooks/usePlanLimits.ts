import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrgPlan = "free" | "pro" | "premium";

export interface PlanLimits {
  maxClients: number | null;
  reports: boolean;
  exportReports: boolean;
  pushNotifications: boolean;
  multiCollaborators: boolean;
  maxCollaborators: number;
  agenda: boolean;
  clients: boolean;
  financial: boolean;
  expenses: boolean;
  notifications: boolean;
  messages: boolean;
}

// Fallback mínimo caso a tabela platform_plan_limits esteja inacessível
const FREE_FALLBACK: PlanLimits = {
  maxClients: 5,
  reports: false,
  exportReports: false,
  pushNotifications: true,
  multiCollaborators: false,
  maxCollaborators: 1,
  agenda: true,
  clients: true,
  financial: true,
  expenses: true,
  notifications: true,
  messages: true,
};

function dbRowToLimits(row: any): PlanLimits {
  return {
    maxClients: row.max_clients ?? null,
    reports: row.reports ?? false,
    exportReports: row.export_reports ?? false,
    pushNotifications: row.push_notifications ?? true,
    multiCollaborators: row.multi_collaborators ?? false,
    maxCollaborators: row.max_collaborators ?? 1,
    agenda: row.agenda ?? true,
    clients: row.clients ?? true,
    financial: row.financial ?? true,
    expenses: row.expenses ?? true,
    notifications: row.notifications ?? true,
    messages: row.messages ?? true,
  };
}

export function usePlanLimits() {
  const { organizationId, user, isSuperAdmin } = useAuth();

  // 1. Org data — source of truth for the plan slug
  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["org-plan", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("plan, status")
        .eq("id", organizationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const plan = (orgData?.plan as OrgPlan) || "free";

  // 2. Subscription record (if any)
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["current-subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, plan_id")
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  // 2b. Promotion/trial record
  const { data: promoData, isLoading: promoLoading } = useQuery({
    queryKey: ["org-promo-limits", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("id, status, trial_ends_at, promotion_type")
        .eq("organization_id", organizationId)
        .in("status", ["trial_active", "lifetime_active"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });

  // 3. Plan limits from DB — single source of truth (Super Admin config)
  const { data: dbLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ["platform-plan-limits", plan],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("*")
        .eq("plan", plan)
        .single();
      if (error) return null;
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 4. Client count
  const { data: clientCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["client-count", organizationId],
    queryFn: async () => {
      if (!organizationId) return 0;
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!organizationId,
  });

  // ── Trial expiry check ──
  const isTrialExpired = (() => {
    return false; // Trials desativados — todas as contas com acesso completo
    if (isSuperAdmin) return false;
    if (!promoData) return false;
    if (promoData.status === "lifetime_active") return false;
    if (promoData.status === "trial_active" && promoData.trial_ends_at) {
      return new Date(promoData.trial_ends_at) < new Date();
    }
    return false;
  })();

  const hasActiveSubscription = !!subscription && subscription.status === "active";

  // ── Subscription state ──
  // Super admins are NEVER considered expired or blocked
  const isSubscriptionExpired = (() => {
    return false; // Cobrança desativada no app — nenhum bloqueio por assinatura
    if (isSuperAdmin) return false;
    if (plan === "free") return false;
    // Trial expired without active subscription → expired
    if (isTrialExpired && !hasActiveSubscription) return true;
    // No subscription record and no trial → plan set by Super Admin, trust it
    if (!subscription && !isTrialExpired) return false;
    if (subscription?.status === "pending") return true;
    if (subscription?.current_period_end) {
      return new Date(subscription.current_period_end) < new Date();
    }
    return false;
  })();

  const isSubscriptionPending = isSuperAdmin ? false : subscription?.status === "pending";

  const daysOverdue = (() => {
    if (isSuperAdmin) return 0;
    if (!subscription?.current_period_end) return 0;
    if (subscription.status !== "pending" && !isSubscriptionExpired) return 0;
    const endDate = new Date(subscription.current_period_end);
    const diffMs = Date.now() - endDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  })();

  const isGracePeriod = isSubscriptionPending && daysOverdue <= 3;
  const isBlocked = isSuperAdmin ? false : orgData?.status === "suspenso";

  // Effective plan: if expired (and not super admin), fall back to free
  const effectivePlan: OrgPlan = isSubscriptionExpired ? "free" : plan;

  // Limits: use DB limits mapped to effectivePlan; fallback only if DB unavailable
  const { data: effectiveDbLimits } = useQuery({
    queryKey: ["platform-plan-limits", effectivePlan],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("*")
        .eq("plan", effectivePlan)
        .single();
      if (error) return null;
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
    enabled: effectivePlan !== plan, // only fetch if different from already-fetched plan
  });

  const resolvedDbRow = effectivePlan === plan ? dbLimits : (effectiveDbLimits ?? dbLimits);
  const limits: PlanLimits = resolvedDbRow ? dbRowToLimits(resolvedDbRow) : FREE_FALLBACK;

  const isOrgSuspended = isSuperAdmin ? false : orgData?.status === "suspenso";
  const canAddClient = limits.maxClients === null || clientCount < limits.maxClients;
  const remainingClients = limits.maxClients !== null ? Math.max(0, limits.maxClients - clientCount) : null;

  return {
    plan: effectivePlan,
    originalPlan: plan,
    limits,
    clientCount,
    canAddClient,
    remainingClients,
    isOrgSuspended,
    isSubscriptionExpired,
    isSubscriptionPending,
    isGracePeriod,
    isBlocked,
    isTrialExpired,
    hasActiveSubscription,
    daysOverdue,
    subscriptionEndDate: subscription?.current_period_end ?? null,
    isLoading: orgLoading || countLoading || limitsLoading || subLoading || promoLoading,
    planLabel: effectivePlan === "free" ? "Free" : effectivePlan === "pro" ? "Pro" : "Premium",
  };
}
