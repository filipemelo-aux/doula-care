import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Users, CalendarDays, MessageSquare, FileText } from "lucide-react";

interface OrgActivity {
  id: string;
  name: string;
  plan: string;
  clientCount: number;
  appointmentCount: number;
  notificationCount: number;
  diaryCount: number;
  totalScore: number;
}

function useTopActiveOrgs() {
  return useQuery({
    queryKey: ["top-active-orgs"],
    queryFn: async () => {
      const [
        { data: organizations },
        { data: clients },
        { data: appointments },
        { data: notifications },
        { data: diary },
      ] = await Promise.all([
        supabase.from("organizations").select("id, name, plan").eq("status", "ativo" as any),
        supabase.from("clients").select("id, organization_id"),
        supabase.from("appointments").select("id, organization_id"),
        supabase.from("client_notifications").select("id, organization_id"),
        supabase.from("pregnancy_diary").select("id, organization_id"),
      ]);

      const orgMap = new Map<string, OrgActivity>();
      (organizations || []).forEach((org) => {
        orgMap.set(org.id, { id: org.id, name: org.name, plan: org.plan, clientCount: 0, appointmentCount: 0, notificationCount: 0, diaryCount: 0, totalScore: 0 });
      });

      (clients || []).forEach((c) => { if (c.organization_id && orgMap.has(c.organization_id)) orgMap.get(c.organization_id)!.clientCount++; });
      (appointments || []).forEach((a) => { if (a.organization_id && orgMap.has(a.organization_id)) orgMap.get(a.organization_id)!.appointmentCount++; });
      (notifications || []).forEach((n) => { if (n.organization_id && orgMap.has(n.organization_id)) orgMap.get(n.organization_id)!.notificationCount++; });
      (diary || []).forEach((d) => { if (d.organization_id && orgMap.has(d.organization_id)) orgMap.get(d.organization_id)!.diaryCount++; });

      orgMap.forEach((org) => {
        org.totalScore = org.clientCount * 3 + org.appointmentCount * 2 + org.notificationCount + org.diaryCount;
      });

      return Array.from(orgMap.values()).filter((o) => o.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);
    },
    staleTime: 60_000,
  });
}

const planStyle: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function TopActiveOrgsCard() {
  const { data: orgs, isLoading } = useTopActiveOrgs();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full mt-1" />
          <Skeleton className="h-3 w-3/4 mt-1" />
        </CardContent>
      </Card>
    );
  }

  const top3 = (orgs || []).slice(0, 3);

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-medium text-muted-foreground">Mais Ativas</p>
          </div>
          {top3.length > 0 ? (
            <div className="space-y-1">
              {top3.map((org, i) => (
                <div key={org.id} className="flex items-center justify-between text-xs gap-1">
                  <span className="text-muted-foreground truncate">
                    {i + 1}. {org.name}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums shrink-0">
                    {org.totalScore}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem dados</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Organizações Mais Ativas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {(orgs || []).map((org, index) => {
              const maxScore = orgs?.[0]?.totalScore || 1;
              const barWidth = Math.max((org.totalScore / maxScore) * 100, 8);
              return (
                <div key={org.id} className="relative rounded-lg p-3 bg-muted/30 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/[0.06] rounded-lg"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="relative flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">
                      {index + 1}º
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{org.name}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${planStyle[org.plan] || ""}`}>
                          {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                        </Badge>
                        <span className="text-xs font-bold text-primary ml-auto tabular-nums shrink-0">
                          {org.totalScore} pts
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                  </div>
                </div>
              );
            })}
            {(!orgs || orgs.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhuma atividade registrada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
