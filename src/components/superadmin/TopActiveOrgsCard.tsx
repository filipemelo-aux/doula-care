import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Users, CalendarDays, MessageSquare, FileText, LogIn } from "lucide-react";

interface OrgActivity {
  id: string;
  name: string;
  plan: string;
  loginCount: number;
  clientCount: number;
  appointmentCount: number;
  notificationCount: number;
  diaryCount: number;
  totalScore: number;
}

function useOrgActivity() {
  return useQuery({
    queryKey: ["org-activity-last-month"],
    queryFn: async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const since = oneMonthAgo.toISOString();

      const [
        { data: organizations },
        { data: accessLogs },
        { data: appointments },
        { data: notifications },
        { data: diary },
        { data: clients },
      ] = await Promise.all([
        supabase.from("organizations").select("id, name, plan"),
        supabase.from("org_access_log" as any).select("id, organization_id").gte("accessed_at", since),
        supabase.from("appointments").select("id, organization_id").gte("created_at", since),
        supabase.from("client_notifications").select("id, organization_id").gte("created_at", since),
        supabase.from("pregnancy_diary").select("id, organization_id").gte("created_at", since),
        supabase.from("clients").select("id, organization_id"),
      ]);

      const orgMap = new Map<string, OrgActivity>();
      (organizations || []).forEach((org) => {
        orgMap.set(org.id, {
          id: org.id, name: org.name, plan: org.plan,
          loginCount: 0, clientCount: 0, appointmentCount: 0, notificationCount: 0, diaryCount: 0, totalScore: 0,
        });
      });

      ((accessLogs as any[]) || []).forEach((l: any) => {
        if (l.organization_id && orgMap.has(l.organization_id)) orgMap.get(l.organization_id)!.loginCount++;
      });
      (clients || []).forEach((c) => {
        if (c.organization_id && orgMap.has(c.organization_id)) orgMap.get(c.organization_id)!.clientCount++;
      });
      (appointments || []).forEach((a) => {
        if (a.organization_id && orgMap.has(a.organization_id)) orgMap.get(a.organization_id)!.appointmentCount++;
      });
      (notifications || []).forEach((n) => {
        if (n.organization_id && orgMap.has(n.organization_id)) orgMap.get(n.organization_id)!.notificationCount++;
      });
      (diary || []).forEach((d) => {
        if (d.organization_id && orgMap.has(d.organization_id)) orgMap.get(d.organization_id)!.diaryCount++;
      });

      orgMap.forEach((org) => {
        org.totalScore = org.loginCount * 4 + org.appointmentCount * 3 + org.notificationCount * 2 + org.diaryCount * 2 + org.clientCount;
      });

      return Array.from(orgMap.values()).sort((a, b) => b.totalScore - a.totalScore);
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
  const maxScore = top3[0]?.totalScore || 1;

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
                    <span className="font-semibold text-foreground tabular-nums shrink-0">{org.totalScore}</span>
                  </div>
                  <HorizontalBar value={org.totalScore} max={maxScore} />
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
              Atividade das Organizações (últimos 30 dias)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 mt-2">
            {(allOrgs || []).map((org, index) => {
              const globalMax = allOrgs?.[0]?.totalScore || 1;
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
                      {org.totalScore}
                    </span>
                  </div>
                  <HorizontalBar value={org.totalScore} max={globalMax} />
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1" title="Acessos">
                      <LogIn className="h-3 w-3" />{org.loginCount}
                    </span>
                    <span className="flex items-center gap-1" title="Gestantes">
                      <Users className="h-3 w-3" />{org.clientCount}
                    </span>
                    <span className="flex items-center gap-1" title="Consultas">
                      <CalendarDays className="h-3 w-3" />{org.appointmentCount}
                    </span>
                    <span className="flex items-center gap-1" title="Notificações">
                      <MessageSquare className="h-3 w-3" />{org.notificationCount}
                    </span>
                    <span className="flex items-center gap-1" title="Diário">
                      <FileText className="h-3 w-3" />{org.diaryCount}
                    </span>
                  </div>
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
