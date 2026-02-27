import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrgPlan = "free" | "pro" | "premium";

export interface PlanLimits {
  maxClients: number | null; // null = unlimited
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
  const { organizationId } = useAuth();

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
    staleTime: 0,
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

  const fallback = DEFAULT_LIMITS[plan];
  const limits: PlanLimits = dbLimits
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
    plan,
    limits,
    clientCount,
    canAddClient,
    remainingClients,
    isOrgSuspended,
    isLoading: orgLoading || countLoading || limitsLoading,
    planLabel: plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Premium",
  };
}
