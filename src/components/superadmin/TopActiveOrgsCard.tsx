import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, LogIn, UserPlus, CalendarDays, Bell, FileText, FileSignature, CreditCard, Briefcase } from "lucide-react";

interface OrgActivity {
  id: string;
  name: string;
  plan: string;
  logins: number;
  clientsCreated: number;
  appointments: number;
  notifications: number;
  diaryEntries: number;
  contracts: number;
  payments: number;
  serviceRequests: number;
  totalActions: number;
}

const actionIcons: Record<string, { icon: typeof LogIn; label: string }> = {
  login: { icon: LogIn, label: "Acessos" },
  client_created: { icon: UserPlus, label: "Gestantes" },
  appointment_created: { icon: CalendarDays, label: "Consultas" },
  notification_sent: { icon: Bell, label: "Notificações" },
  diary_entry: { icon: FileText, label: "Diário" },
  contract_created: { icon: FileSignature, label: "Contratos" },
  payment_created: { icon: CreditCard, label: "Pagamentos" },
  service_request: { icon: Briefcase, label: "Serviços" },
};

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
        orgMap.set(org.id, {
          id: org.id, name: org.name, plan: org.plan,
          logins: 0, clientsCreated: 0, appointments: 0, notifications: 0,
          diaryEntries: 0, contracts: 0, payments: 0, serviceRequests: 0, totalActions: 0,
        });
      });

      ((logs as any[]) || []).forEach((log: any) => {
        const org = orgMap.get(log.organization_id);
        if (!org) return;
        org.totalActions++;
        switch (log.action) {
          case "login": org.logins++; break;
          case "client_created": org.clientsCreated++; break;
          case "appointment_created": org.appointments++; break;
          case "notification_sent": org.notifications++; break;
          case "diary_entry": org.diaryEntries++; break;
          case "contract_created": org.contracts++; break;
          case "payment_created": org.payments++; break;
          case "service_request": org.serviceRequests++; break;
        }
      });

      return Array.from(orgMap.values()).sort((a, b) => b.totalActions - a.totalActions);
    },
    staleTime: 60_000,
  });
}

const planStyle: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function HorizontalBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ActionChips({ org }: { org: OrgActivity }) {
  const items = [
    { key: "login", count: org.logins },
    { key: "client_created", count: org.clientsCreated },
    { key: "appointment_created", count: org.appointments },
    { key: "notification_sent", count: org.notifications },
    { key: "diary_entry", count: org.diaryEntries },
    { key: "contract_created", count: org.contracts },
    { key: "payment_created", count: org.payments },
    { key: "service_request", count: org.serviceRequests },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return <span className="text-[11px] text-muted-foreground">Sem atividade no período</span>;

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
      {items.map((item) => {
        const config = actionIcons[item.key];
        const Icon = config.icon;
        return (
          <span key={item.key} className="flex items-center gap-1" title={config.label}>
            <Icon className="h-3 w-3" />{item.count}
          </span>
        );
      })}
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
  const maxScore = top3[0]?.totalActions || 1;

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
            <div className="space-y-2">
              {top3.map((org) => (
                <div key={org.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] gap-1">
                    <span className="text-muted-foreground truncate">{org.name}</span>
                    <span className="font-semibold text-foreground tabular-nums shrink-0">{org.totalActions}</span>
                  </div>
                  <HorizontalBar value={org.totalActions} max={maxScore} />
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
          <p className="text-xs text-muted-foreground shrink-0">
            Registra logins e ações permanentemente — mesmo que dados sejam excluídos depois.
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 mt-2">
            {(allOrgs || []).map((org, index) => {
              const globalMax = allOrgs?.[0]?.totalActions || 1;
              return (
                <div key={org.id} className="rounded-lg p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground w-5 text-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate flex-1">{org.name}</span>
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${planStyle[org.plan] || ""}`}>
                      {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                    </Badge>
                    <span className="text-xs font-bold text-primary tabular-nums shrink-0">
                      {org.totalActions}
                    </span>
                  </div>
                  <HorizontalBar value={org.totalActions} max={globalMax} />
                  <ActionChips org={org} />
                </div>
              );
            })}
            {(!allOrgs || allOrgs.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhuma organização cadastrada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
