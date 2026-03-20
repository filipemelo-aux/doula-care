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
  actions: number;
}

type OrgCountRow = { organization_id: string | null };

const countByOrg = (rows: OrgCountRow[] | null | undefined) => {
  const m = new Map<string, number>();
  (rows || []).forEach((r) => {
    if (!r.organization_id) return;
    m.set(r.organization_id, (m.get(r.organization_id) || 0) + 1);
  });
  return m;
};

function useOrgActivity() {
  return useQuery({
    queryKey: ["org-activity-actions-30d"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 1);
      const s = since.toISOString();

      const [orgsR, cliR, appR, notR, diaR, conR, payR, srvR] = await Promise.all([
        supabase.from("organizations").select("id, name, nome_exibicao, plan"),
        supabase.from("clients").select("organization_id").gte("updated_at", s),
        supabase.from("appointments").select("organization_id").gte("updated_at", s),
        supabase.from("client_notifications").select("organization_id").gte("created_at", s),
        supabase.from("pregnancy_diary").select("organization_id").gte("updated_at", s),
        supabase.from("client_contracts").select("organization_id").gte("updated_at", s),
        supabase.from("payments").select("organization_id").gte("updated_at", s),
        supabase.from("service_requests").select("organization_id").gte("updated_at", s),
      ]);

      const totals = [cliR, appR, notR, diaR, conR, payR, srvR]
        .map((r) => countByOrg(r.data))
        .reduce((acc, cur) => {
          cur.forEach((v, k) => acc.set(k, (acc.get(k) || 0) + v));
          return acc;
        }, new Map<string, number>());

      return (orgsR.data || [])
        .map((o) => ({
          id: o.id,
          name: o.nome_exibicao || o.name,
          plan: o.plan,
          actions: totals.get(o.id) || 0,
        }))
        .sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name));
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

function ActionBar({ actions, max }: { actions: number; max: number }) {
  const pct = max > 0 ? Math.max((actions / max) * 100, actions > 0 ? 6 : 0) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-foreground">
        {actions}
      </span>
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
  const max = Math.max(...(allOrgs || []).map((o) => o.actions), 1);

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
                  <ActionBar actions={org.actions} max={max} />
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
              Ações Reais (últimos 30 dias)
            </DialogTitle>
            <DialogDescription>
              Gestantes, consultas, pagamentos, notificações, contratos e serviços movimentados.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1">
            {(allOrgs || []).map((org, i) => (
              <div key={org.id} className="space-y-1.5 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{org.name}</span>
                  <Badge
                    variant="outline"
                    className={`h-4 shrink-0 px-1.5 text-[10px] ${planStyle[org.plan] || ""}`}
                  >
                    {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                  </Badge>
                </div>
                <ActionBar actions={org.actions} max={max} />
              </div>
            ))}
            {(!allOrgs || allOrgs.length === 0) && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma organização cadastrada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
