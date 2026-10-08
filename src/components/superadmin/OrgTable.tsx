import { useMemo, useState } from "react";
import { Ban, CheckCircle, Trash2, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Eye, Apple, Smartphone, Globe } from "lucide-react";
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
  puerpera_count?: number;
  avulsa_count?: number;
  last_access?: string | null;
  last_access_platform?: string | null;
}

const AndroidIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.76 0L5.3 5.92a.38.38 0 1 0-.66.38L6.48 9.48A10.2 10.2 0 0 0 1.5 17.5h21a10.2 10.2 0 0 0-4.9-8.02ZM7 14.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  </svg>
);

const AccessPlatformIcon = ({ platform }: { platform?: string | null }) => {
  const label = platform
    ? (ACCESS_PLATFORM_LABEL[platform as keyof typeof ACCESS_PLATFORM_LABEL] || platform)
    : "Acesso anterior a este recurso";
  const common = "h-3 w-3 shrink-0";
  // Apps nativos têm ícone próprio; todo acesso por navegador usa o ícone universal.
  const icon =
    platform === "app_ios" ? (
      <Apple className={cn(common, "text-foreground/70")} />
    ) : platform === "app_android" ? (
      <AndroidIcon className={cn(common, "text-success")} />
    ) : (
      <Globe className={cn(common, platform ? "text-blue-500" : "text-muted-foreground/50")} />
    );
  return (
    <span title={label} aria-label={label} className="inline-flex items-center">
      {icon}
    </span>
  );
};

type SortKey =
  | "name"
  | "email"
  | "plan"
  | "status"
  | "clients"
  | "puerperas"
  | "avulsas"
  | "device"
  | "created"
  | "last_access";
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
  defaultSort = "last_access",
  defaultDir = "desc",
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<string>("");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [device, setDevice] = useState<string>("all");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" || key === "clients" || key === "puerperas" || key === "avulsas" || key === "last_access" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = orgs.map((o) => ({ ...o, last_access: o.last_access || o.created_at })).filter((o) => {
      if (device !== "all") {
        const p = o.last_access_platform || "none";
        if (device === "app" ? !p.startsWith("app_") : device === "browser" ? !p.startsWith("browser_") : p !== device) return false;
      }
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
        case "puerperas":
          return ((a.puerpera_count ?? 0) - (b.puerpera_count ?? 0)) * dir;
        case "avulsas":
          return ((a.avulsa_count ?? 0) - (b.avulsa_count ?? 0)) * dir;
        case "device": {
          const platformLabel = (p?: string | null) =>
            p ? (ACCESS_PLATFORM_LABEL[p as keyof typeof ACCESS_PLATFORM_LABEL] || p) : "";
          return platformLabel(a.last_access_platform).localeCompare(platformLabel(b.last_access_platform)) * dir;
        }
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
  }, [orgs, sortKey, sortDir, activity, device]);

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
    <TableHead className={cn("h-8 px-1.5 text-[11px] whitespace-nowrap", className)}>
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
        <Select value={device} onValueChange={setDevice}>
          <SelectTrigger className="h-7 w-[150px] shrink-0 px-2 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos dispositivos</SelectItem>
            <SelectItem value="app">Aplicativo (todos)</SelectItem>
            <SelectItem value="app_ios">Aplicativo iPhone</SelectItem>
            <SelectItem value="app_android">Aplicativo Android</SelectItem>
            <SelectItem value="browser">Navegador (todos)</SelectItem>
            <SelectItem value="browser_ios">Navegador iPhone</SelectItem>
            <SelectItem value="browser_android">Navegador Android</SelectItem>
            <SelectItem value="browser_desktop">Navegador computador</SelectItem>
            <SelectItem value="none">Sem registro</SelectItem>
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
        <Table className="min-w-[990px] w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 w-7 px-1">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <SortHeader label="Organização" k="name" className="w-[160px]" />
              <SortHeader label="Email" k="email" className="w-[160px]" />
              <SortHeader label="Plano" k="plan" className="w-[76px] text-center" />
              <SortHeader label="Status" k="status" className="w-[76px] text-center" />
              <SortHeader label="Gestantes" k="clients" className="w-[70px] text-center" />
              <SortHeader label="Puérperas" k="puerperas" className="w-[74px] text-center" />
              <SortHeader label="Avulsas" k="avulsas" className="w-[60px] text-center" />
              <SortHeader label="Últ. acesso" k="last_access" className="w-[74px] text-center" />
              <SortHeader label="Dispositivo" k="device" className="w-[150px] text-center" />
              <SortHeader label="Desde" k="created" className="w-[60px] text-center" />
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
                  <TableCell className="py-1 px-1.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(org.id)}
                      aria-label={`Selecionar ${displayName}`}
                    />
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds(new Set([org.id]));
                          onViewDetails?.(org.id);
                        }}
                        className="text-xs font-medium text-foreground truncate leading-tight max-w-[125px] text-left hover:underline"
                      >
                        {displayName}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-[11px] text-muted-foreground">
                    <span className="truncate inline-block max-w-[125px] align-middle">{org.responsible_email}</span>
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                    <Select value={org.plan} onValueChange={(v) => onPlanChange(org.id, v as any)}>
                      <SelectTrigger className={cn("h-6 w-[62px] min-w-0 mx-auto px-1.5 text-[10px] border-0", planBadgeStyles[org.plan])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-center">
                    {org.status === "suspenso" ? (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-destructive/15 text-destructive">Suspenso</Badge>
                    ) : org.status === "pendente" ? (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendente</Badge>
                    ) : (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium rounded-full bg-success/15 text-success">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-center text-xs font-semibold text-foreground tabular-nums">{org.client_count}</TableCell>
                  <TableCell className="px-1.5 py-1 text-center text-xs text-muted-foreground tabular-nums">{org.puerpera_count ?? 0}</TableCell>
                  <TableCell className="px-1.5 py-1 text-center text-xs text-muted-foreground tabular-nums">{org.avulsa_count ?? 0}</TableCell>
                  <TableCell
                    className={cn(
                      "px-1.5 py-1 text-[11px] whitespace-nowrap text-center tabular-nums",
                      !org.last_access ? "text-muted-foreground/70" : "text-muted-foreground"
                    )}
                    title={org.last_access ? format(new Date(org.last_access), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Sem registro"}
                  >
                    {relativeAccess(org.last_access)}
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap text-center">
                    <span className="inline-flex items-center gap-1">
                      <AccessPlatformIcon platform={org.last_access_platform} />
                      {org.last_access_platform
                        ? ACCESS_PLATFORM_LABEL[org.last_access_platform as keyof typeof ACCESS_PLATFORM_LABEL] || org.last_access_platform
                        : "Sem registro"}
                    </span>
                  </TableCell>
                  <TableCell className="px-1.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap text-center tabular-nums">
                    {format(new Date(org.created_at), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
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
