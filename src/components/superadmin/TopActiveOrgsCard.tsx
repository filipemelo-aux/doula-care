import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "lucide-react";

interface OrgActivity {
  id: string;
  name: string;
  plan: string;
  logins: number;
  actions: number;
}

type OrgCountRow = {
  organization_id: string | null;
};

const countByOrganization = (rows: OrgCountRow[] | null | undefined) => {
  const counts = new Map<string, number>();

  (rows || []).forEach((row) => {
    if (!row.organization_id) return;
    counts.set(row.organization_id, (counts.get(row.organization_id) || 0) + 1);
  });

  return counts;
};

function useOrgActivity() {
  return useQuery({
    queryKey: ["org-activity-last-30-days-v2"],
    queryFn: async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const since = oneMonthAgo.toISOString();

      const [
        organizationsResult,
        logsResult,
        clientsResult,
        appointmentsResult,
        notificationsResult,
        diaryResult,
        contractsResult,
        paymentsResult,
        serviceRequestsResult,
      ] = await Promise.all([
        supabase.from("organizations").select("id, name, nome_exibicao, plan"),
        supabase
          .from("org_access_log")
          .select("organization_id, action")
          .gte("accessed_at", since),
        supabase.from("clients").select("organization_id").gte("updated_at", since),
        supabase.from("appointments").select("organization_id").gte("updated_at", since),
        supabase.from("client_notifications").select("organization_id").gte("created_at", since),
        supabase.from("pregnancy_diary").select("organization_id").gte("updated_at", since),
        supabase.from("client_contracts").select("organization_id").gte("updated_at", since),
        supabase.from("payments").select("organization_id").gte("updated_at", since),
        supabase.from("service_requests").select("organization_id").gte("updated_at", since),
      ]);

      const queryErrors = [
        organizationsResult.error,
        logsResult.error,
        clientsResult.error,
        appointmentsResult.error,
        notificationsResult.error,
        diaryResult.error,
        contractsResult.error,
        paymentsResult.error,
        serviceRequestsResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        throw queryErrors[0];
      }

      const fallbackActionCounts = [
        countByOrganization(clientsResult.data),
        countByOrganization(appointmentsResult.data),
        countByOrganization(notificationsResult.data),
        countByOrganization(diaryResult.data),
        countByOrganization(contractsResult.data),
        countByOrganization(paymentsResult.data),
        countByOrganization(serviceRequestsResult.data),
      ].reduce((acc, current) => {
        current.forEach((value, key) => {
          acc.set(key, (acc.get(key) || 0) + value);
        });
        return acc;
      }, new Map<string, number>());

      const orgMap = new Map<string, OrgActivity>();
      (organizationsResult.data || []).forEach((org) => {
        orgMap.set(org.id, {
          id: org.id,
          name: org.nome_exibicao || org.name,
          plan: org.plan,
          logins: 0,
          actions: 0,
        });
      });

      (logsResult.data || []).forEach((log) => {
        const org = orgMap.get(log.organization_id);
        if (!org) return;

        if (log.action === "login") {
          org.logins += 1;
          return;
        }

        org.actions += 1;
      });

      orgMap.forEach((org) => {
        const fallbackActions = fallbackActionCounts.get(org.id) || 0;
        org.actions = Math.max(org.actions, fallbackActions);
      });

      return Array.from(orgMap.values()).sort((a, b) => {
        const totalDiff = b.logins + b.actions - (a.logins + a.actions);
        return totalDiff !== 0 ? totalDiff : a.name.localeCompare(b.name);
      });
    },
    staleTime: 10_000,
    refetchOnMount: "always",
  });
}

const planStyle: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  premium: "bg-secondary text-secondary-foreground",
};

function DualBar({
  logins,
  actions,
  maxLogins,
  maxActions,
}: {
  logins: number;
  actions: number;
  maxLogins: number;
  maxActions: number;
}) {
  const loginPct = maxLogins > 0 ? Math.max((logins / maxLogins) * 100, logins > 0 ? 6 : 0) : 0;
  const actionPct = maxActions > 0 ? Math.max((actions / maxActions) * 100, actions > 0 ? 6 : 0) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] text-muted-foreground">Logins</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${loginPct}%` }}
          />
        </div>
        <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-foreground">
          {logins}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] text-muted-foreground">Ações</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out"
            style={{ width: `${actionPct}%` }}
          />
        </div>
        <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-foreground">
          {actions}
        </span>
      </div>
    </div>
  );
}

export function TopActiveOrgsCard() {
  const { data: allOrgs, isLoading } = useOrgActivity();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mt-2 h-2 w-full" />
          <Skeleton className="mt-2 h-2 w-3/4" />
          <Skeleton className="mt-2 h-2 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const top3 = (allOrgs || []).slice(0, 3);
  const maxLogins = Math.max(...(allOrgs || []).map((org) => org.logins), 1);
  const maxActions = Math.max(...(allOrgs || []).map((org) => org.actions), 1);

  return (
    <>
      <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setOpen(true)}>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-medium text-muted-foreground">Atividade (30d)</p>
          </div>

          {top3.length > 0 ? (
            <div className="space-y-2.5">
              {top3.map((org) => (
                <div key={org.id}>
                  <p className="mb-1 truncate text-[11px] text-muted-foreground">{org.name}</p>
                  <DualBar
                    logins={org.logins}
                    actions={org.actions}
                    maxLogins={maxLogins}
                    maxActions={maxActions}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem atividade</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Utilização Real (últimos 30 dias)
            </DialogTitle>
            <DialogDescription>
              As ações agora usam o histórico salvo e também a movimentação real recente para evitar zeros incorretos.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-1 flex shrink-0 items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Logins
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-secondary" /> Ações
            </span>
          </div>

          <div className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1">
            {(allOrgs || []).map((org, index) => (
              <div key={org.id} className="space-y-1.5 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{org.name}</span>
                  <Badge
                    variant="outline"
                    className={`h-4 shrink-0 px-1.5 text-[10px] ${planStyle[org.plan] || ""}`}
                  >
                    {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                  </Badge>
                </div>
                <DualBar
                  logins={org.logins}
                  actions={org.actions}
                  maxLogins={maxLogins}
                  maxActions={maxActions}
                />
              </div>
            ))}

            {(!allOrgs || allOrgs.length === 0) && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma organização cadastrada
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
