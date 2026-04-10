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

const DEFAULT_LIMITS: Record<OrgPlan, PlanLimits> = {
  free: {
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
  },
  pro: {
    maxClients: null,
    reports: true,
    exportReports: true,
    pushNotifications: true,
    multiCollaborators: false,
    maxCollaborators: 1,
    agenda: true,
    clients: true,
    financial: true,
    expenses: true,
    notifications: true,
    messages: true,
  },
  premium: {
    maxClients: null,
    reports: true,
    exportReports: true,
    pushNotifications: true,
    multiCollaborators: true,
    maxCollaborators: 5,
    agenda: true,
    clients: true,
    financial: true,
    expenses: true,
    notifications: true,
    messages: true,
  },
};

export function usePlanLimits() {
  const { organizationId, user } = useAuth();

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

  // Check subscription status (active OR pending)
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

  // Determine subscription state
  const isSubscriptionPending = subscription?.status === "pending";

  const isSubscriptionExpired = (() => {
    if (plan === "free") return false;
    // No subscription record = plan set by Super Admin, trust the org plan
    if (!subscription) return false;
    if (subscription.status === "pending") return true;
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end) < new Date();
    }
    return false;
  })();

  // Calculate days overdue for pending subscriptions (grace period tracking)
  const daysOverdue = (() => {
    if (!subscription?.current_period_end) return 0;
    if (subscription.status !== "pending" && !isSubscriptionExpired) return 0;
    const endDate = new Date(subscription.current_period_end);
    const diffMs = Date.now() - endDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  })();

  // Grace period: 3 days. After that, access is blocked by the cron job (org status = suspenso)
  const isGracePeriod = isSubscriptionPending && daysOverdue <= 3;
  const isBlocked = orgData?.status === "suspenso";

  // If subscription expired/pending, enforce free limits
  const effectivePlan: OrgPlan = isSubscriptionExpired ? "free" : plan;
  const fallback = DEFAULT_LIMITS[effectivePlan];

  const limits: PlanLimits = isSubscriptionExpired
    ? fallback
    : dbLimits
      ? {
          maxClients: dbLimits.max_clients ?? null,
          reports: dbLimits.reports ?? fallback.reports,
          exportReports: dbLimits.export_reports ?? fallback.exportReports,
          pushNotifications: dbLimits.push_notifications ?? fallback.pushNotifications,
          multiCollaborators: dbLimits.multi_collaborators ?? fallback.multiCollaborators,
          maxCollaborators: dbLimits.max_collaborators ?? fallback.maxCollaborators,
          agenda: dbLimits.agenda ?? fallback.agenda,
          clients: dbLimits.clients ?? fallback.clients,
          financial: dbLimits.financial ?? fallback.financial,
          expenses: dbLimits.expenses ?? fallback.expenses,
          notifications: dbLimits.notifications ?? fallback.notifications,
          messages: dbLimits.messages ?? fallback.messages,
        }
      : fallback;

  const isOrgSuspended = orgData?.status === "suspenso";
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
    daysOverdue,
    subscriptionEndDate: subscription?.current_period_end ?? null,
    isLoading: orgLoading || countLoading || limitsLoading || subLoading,
    planLabel: effectivePlan === "free" ? "Free" : effectivePlan === "pro" ? "Pro" : "Premium",
  };
}
