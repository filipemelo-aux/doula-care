import { useMemo, useState } from "react";
import { Ban, CheckCircle, Trash2, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Eye, Apple, Smartphone, Chrome, Compass, Monitor } from "lucide-react";
import { ACCESS_PLATFORM_LABEL } from "@/lib/accessPlatform";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PromoTriggerButton } from "@/components/superadmin/PromoTriggerButton";

export interface OrgRow {
  id: string;
  name: string;
  nome_exibicao: string | null;
  responsible_email: string;
  plan: "free" | "pro" | "premium";
  status: "ativo" | "suspenso" | "pendente";
  created_at: string;
  client_count: number;
  last_access?: string | null;
  last_access_platform?: string | null;
}

const AccessPlatformIcon = ({ platform }: { platform?: string | null }) => {
  if (!platform) {
    return (
      <span title="Origem não identificada" aria-label="Origem não identificada" className="inline-flex items-center">
        <Globe className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      </span>
    );
  }
  const label = ACCESS_PLATFORM_LABEL[platform as keyof typeof ACCESS_PLATFORM_LABEL] || platform;
  const common = "h-3 w-3 shrink-0";
  const icon =
    platform === "app_ios" ? (
      <Apple className={cn(common, "text-foreground/70")} />
    ) : platform === "app_android" ? (
      <Smartphone className={cn(common, "text-success")} />
    ) : platform === "browser_ios" ? (
      <Compass className={cn(common, "text-blue-500")} />
    ) : platform === "browser_android" ? (
      <Chrome className={cn(common, "text-success")} />
    ) : (
      <Monitor className={cn(common, "text-muted-foreground")} />
    );
  return (
    <span title={label} aria-label={label} className="inline-flex items-center">
      {icon}
    </span>
  );
};

type SortKey = "name" | "email" | "plan" | "status" | "clients" | "created" | "last_access";
type ActivityFilter = "all" | "7" | "30" | "inactive";

const relativeAccess = (value?: string | null) => {
  if (!value) return "Nunca";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours <= 0) return "Agora";
    return `${hours}h`;
  }
  if (days === 1) return "Ontem";
  if (days < 30) return `${days}d`;
  return format(new Date(value), "dd/MM/yy", { locale: ptBR });
};
type SortDir = "asc" | "desc";

const planBadgeStyles: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  premium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const planRank: Record<string, number> = { free: 0, pro: 1, premium: 2 };
const statusRank: Record<string, number> = { pendente: 0, ativo: 1, suspenso: 2 };

interface Props {
  orgs: OrgRow[];
  onlineOrgIds: Set<string>;
  onPlanChange: (orgId: string, plan: "free" | "pro" | "premium") => void;
  onStatusChange: (orgId: string, status: string) => void;
  onDelete: (orgId: string) => void;
  onViewDetails?: (orgId: string) => void;
  isPlanPending?: boolean;
  isStatusPending?: boolean;
  isDeletePending?: boolean;
  defaultSort?: SortKey;
  defaultDir?: SortDir;
}

export function OrgTable({
  orgs,
  onlineOrgIds,
  onPlanChange,
  onStatusChange,
  onDelete,
  onViewDetails,
  isStatusPending,
  isDeletePending,
  defaultSort = "created",
  defaultDir = "desc",
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<string>("");
  const [activity, setActivity] = useState<ActivityFilter>("all");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" || key === "clients" || key === "last_access" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = orgs.filter((o) => {
      if (activity === "all") return true;
      const ts = o.last_access ? new Date(o.last_access).getTime() : 0;
      const days = ts ? (Date.now() - ts) / 86400000 : Infinity;
      if (activity === "7") return days <= 7;
      if (activity === "30") return days <= 30;
      return days > 30;
    });
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const nameA = (a.nome_exibicao?.trim() || a.name).toLowerCase();
      const nameB = (b.nome_exibicao?.trim() || b.name).toLowerCase();
      switch (sortKey) {
        case "name":
          return nameA.localeCompare(nameB) * dir;
        case "email":
          return a.responsible_email.localeCompare(b.responsible_email) * dir;
        case "plan":
          return (planRank[a.plan] - planRank[b.plan]) * dir;
        case "status":
          return (statusRank[a.status] - statusRank[b.status]) * dir;
        case "clients":
          return (a.client_count - b.client_count) * dir;
        case "created":
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
        case "last_access": {
          const ta = a.last_access ? new Date(a.last_access).getTime() : 0;
          const tb = b.last_access ? new Date(b.last_access).getTime() : 0;
          return (ta - tb) * dir;
        }
      }
    });
    return arr;
  }, [orgs, sortKey, sortDir, activity]);

  const selectedOrgs = sorted.filter((o) => selectedIds.has(o.id));
  const selected = selectedOrgs.length === 1 ? selectedOrgs[0] : null;
  const selectedName = selected ? (selected.nome_exibicao?.trim() || selected.name) : "";
  const allSelected = sorted.length > 0 && selectedOrgs.length === sorted.length;

  const toggleSelection = (orgId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sorted.map((o) => o.id)));
  };

  const applyBulkPlan = (plan: string) => {
    if (!plan || selectedOrgs.length === 0) return;
    selectedOrgs.forEach((o) => {
      if (o.plan !== plan) onPlanChange(o.id, plan as "free" | "pro" | "premium");
    });
    setBulkPlan("");
  };

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={cn("h-8 px-2 text-[11px] whitespace-nowrap", className)}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 overflow-x-auto">
        <Select value={activity} onValueChange={(v) => setActivity(v as ActivityFilter)}>
          <SelectTrigger className="h-7 w-[124px] shrink-0 px-2 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="7">Ativas 7 dias</SelectItem>
            <SelectItem value="30">Ativas 30 dias</SelectItem>
            <SelectItem value="inactive">Inativas +30 dias</SelectItem>
          </SelectContent>
        </Select>
        {selectedOrgs.length > 1 && (
          <>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground px-1">
              {selectedOrgs.length} selecionadas
            </span>
            <Select value={bulkPlan} onValueChange={applyBulkPlan}>
              <SelectTrigger className="h-7 w-[142px] shrink-0 px-2 text-[11px]">
                <SelectValue placeholder="Aplicar plano..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Mudar para Free</SelectItem>
                <SelectItem value="pro">Mudar para Pro</SelectItem>
                <SelectItem value="premium">Mudar para Premium</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 shrink-0"
          disabled={!selected}
          onClick={() => selected && onViewDetails?.(selected.id)}
        >
          <Eye className="h-3.5 w-3.5" />
          Ficha
        </Button>
        {selected?.status === "ativo" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 shrink-0"
            disabled={!selected || isStatusPending}
            onClick={() => selected && onStatusChange(selected.id, "suspenso")}
          >
            <Ban className="h-3.5 w-3.5" />
            Suspender
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 shrink-0 text-success"
            disabled={!selected || isStatusPending}
            onClick={() => selected && onStatusChange(selected.id, "ativo")}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Ativar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
          disabled={!selected || isDeletePending}
          onClick={() => {
            if (!selected) return;
            if (window.confirm(`Tem certeza que deseja excluir "${selectedName}"? Esta ação é irreversível.`)) {
              onDelete(selected.id);
              setSelectedIds(new Set());
            }
          }}
        >
          {isDeletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Excluir
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 w-10 px-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <SortHeader label="Organização" k="name" />
              <SortHeader label="Email" k="email" />
              <SortHeader label="Plano" k="plan" />
              <SortHeader label="Status" k="status" />
              <SortHeader label="Gest." k="clients" className="text-right" />
              <SortHeader label="Últ. acesso" k="last_access" />
              <SortHeader label="Desde" k="created" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((org) => {
              const displayName = (org.nome_exibicao && org.nome_exibicao.trim()) || org.name;
              const isSelected = selectedIds.has(org.id);
              return (
                <TableRow
                  key={org.id}
                  onClick={() => setSelectedIds(new Set([org.id]))}
                  onDoubleClick={() => onViewDetails?.(org.id)}
                  className={cn("cursor-pointer", isSelected && "bg-primary/10 hover:bg-primary/10")}
                >
                  <TableCell className="py-1 px-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(org.id)}
                      aria-label={`Selecionar ${displayName}`}
                    />
                  </TableCell>
                  <TableCell className="py-1 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds(new Set([org.id]));
                          onViewDetails?.(org.id);
                        }}
                        className="text-xs font-medium text-foreground truncate leading-tight max-w-[180px] text-left hover:underline"
                      >
                        {displayName}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-1 text-[11px] text-muted-foreground">
                    <span className="truncate inline-block max-w-[180px] align-middle">{org.responsible_email}</span>
                  </TableCell>
                  <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                    <Select value={org.plan} onValueChange={(v) => onPlanChange(org.id, v as any)}>
                      <SelectTrigger className={cn("h-6 w-[66px] min-w-0 px-1.5 text-[10px] border-0", planBadgeStyles[org.plan])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    {org.status === "suspenso" ? (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-destructive/15 text-destructive">Suspenso</Badge>
                    ) : org.status === "pendente" ? (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendente</Badge>
                    ) : (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-success/15 text-success">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right text-xs text-foreground">{org.client_count}</TableCell>
                  <TableCell
                    className={cn(
                      "px-2 py-1 text-[11px] whitespace-nowrap",
                      !org.last_access ? "text-muted-foreground/70" : "text-muted-foreground"
                    )}
                    title={org.last_access ? format(new Date(org.last_access), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Sem registro"}
                  >
                    <span className="inline-flex items-center gap-1">
                      <AccessPlatformIcon platform={org.last_access_platform} />
                      {relativeAccess(org.last_access)}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-1 text-[11px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(org.created_at), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma organização
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
