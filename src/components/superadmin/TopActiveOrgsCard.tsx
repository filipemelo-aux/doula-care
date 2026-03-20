import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, LogIn } from "lucide-react";

interface OrgActivity {
  id: string;
  name: string;
  plan: string;
  logins: number;
  actions: number;
}

function useOrgActivity() {
  return useQuery({
    queryKey: ["org-activity-last-month"],
    queryFn: async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const since = oneMonthAgo.toISOString();

      const [{ data: organizations }, { data: logs }] = await Promise.all([
        supabase.from("organizations").select("id, name, plan"),
        supabase.from("org_access_log" as any).select("organization_id, action").gte("accessed_at", since),
      ]);

      const orgMap = new Map<string, OrgActivity>();
      (organizations || []).forEach((org) => {
        orgMap.set(org.id, { id: org.id, name: org.name, plan: org.plan, logins: 0, actions: 0 });
      });

      ((logs as any[]) || []).forEach((log: any) => {
        const org = orgMap.get(log.organization_id);
        if (!org) return;
        if (log.action === "login") {
          org.logins++;
        } else {
          org.actions++;
        }
      });

      return Array.from(orgMap.values()).sort((a, b) => (b.logins + b.actions) - (a.logins + a.actions));
    },
    staleTime: 60_000,
  });
}

const planStyle: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function DualBar({ logins, actions, maxLogins, maxActions }: { logins: number; actions: number; maxLogins: number; maxActions: number }) {
  const loginPct = maxLogins > 0 ? Math.max((logins / maxLogins) * 100, logins > 0 ? 6 : 0) : 0;
  const actionPct = maxActions > 0 ? Math.max((actions / maxActions) * 100, actions > 0 ? 6 : 0) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-14 shrink-0">Logins</span>
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${loginPct}%` }} />
        </div>
        <span className="text-[10px] font-semibold text-foreground tabular-nums w-6 text-right">{logins}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-14 shrink-0">Ações</span>
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-success transition-all duration-700 ease-out" style={{ width: `${actionPct}%` }} />
        </div>
        <span className="text-[10px] font-semibold text-foreground tabular-nums w-6 text-right">{actions}</span>
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
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-2 w-full mt-2" />
          <Skeleton className="h-2 w-3/4 mt-2" />
          <Skeleton className="h-2 w-1/2 mt-2" />
        </CardContent>
      </Card>
    );
  }

  const top3 = (allOrgs || []).slice(0, 3);
  const maxLogins = Math.max(...(allOrgs || []).map((o) => o.logins), 1);
  const maxActions = Math.max(...(allOrgs || []).map((o) => o.actions), 1);

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-medium text-muted-foreground">Atividade (30d)</p>
          </div>
          {top3.length > 0 ? (
            <div className="space-y-2.5">
              {top3.map((org) => (
                <div key={org.id}>
                  <p className="text-[11px] text-muted-foreground truncate mb-1">{org.name}</p>
                  <DualBar logins={org.logins} actions={org.actions} maxLogins={maxLogins} maxActions={maxActions} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem atividade</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Utilização Real (últimos 30 dias)
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 mt-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Logins
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> Ações (gestantes, consultas, notificações…)
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 mt-3">
            {(allOrgs || []).map((org, index) => (
              <div key={org.id} className="rounded-lg p-3 bg-muted/30 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground w-5 text-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate flex-1">{org.name}</span>
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${planStyle[org.plan] || ""}`}>
                    {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                  </Badge>
                </div>
                <DualBar logins={org.logins} actions={org.actions} maxLogins={maxLogins} maxActions={maxActions} />
              </div>
            ))}
            {(!allOrgs || allOrgs.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhuma organização cadastrada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
