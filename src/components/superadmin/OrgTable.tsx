import { useMemo, useState } from "react";
import { Ban, CheckCircle, Mail, Trash2, Loader2, ArrowUp, ArrowDown, ArrowUpDown, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
}

type SortKey = "name" | "email" | "plan" | "status" | "clients" | "created";
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
  isStatusPending,
  isDeletePending,
  defaultSort = "created",
  defaultDir = "desc",
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" || key === "clients" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...orgs];
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
      }
    });
    return arr;
  }, [orgs, sortKey, sortDir]);

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={className}>
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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHeader label="Organização" k="name" />
              <SortHeader label="Email" k="email" className="hidden md:table-cell" />
              <SortHeader label="Plano" k="plan" />
              <SortHeader label="Status" k="status" />
              <SortHeader label="Gestantes" k="clients" className="hidden sm:table-cell text-right" />
              <SortHeader label="Desde" k="created" className="hidden lg:table-cell" />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((org) => {
              const displayName = (org.nome_exibicao && org.nome_exibicao.trim()) || org.name;
              const initials = displayName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <TableRow key={org.id} className="group">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-primary">{initials}</span>
                        {onlineOrgIds.has(org.id) && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" title="Online agora" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">{displayName}</p>
                        <p className="text-[11px] text-muted-foreground md:hidden flex items-center gap-1 mt-0.5">
                          <Mail className="h-2.5 w-2.5" />
                          <span className="truncate">{org.responsible_email}</span>
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    <span className="truncate inline-block max-w-[220px] align-middle">{org.responsible_email}</span>
                  </TableCell>
                  <TableCell>
                    <Select value={org.plan} onValueChange={(v) => onPlanChange(org.id, v as any)}>
                      <SelectTrigger className={cn("h-7 w-[92px] text-xs border-0", planBadgeStyles[org.plan])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {org.status === "suspenso" ? (
                      <Badge className="h-5 px-2 text-[10px] font-medium rounded-full bg-destructive/15 text-destructive">Suspenso</Badge>
                    ) : org.status === "pendente" ? (
                      <Badge className="h-5 px-2 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendente</Badge>
                    ) : (
                      <Badge className="h-5 px-2 text-[10px] font-medium rounded-full bg-success/15 text-success">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-sm text-foreground">{org.client_count}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <TooltipProvider>
                        {org.status === "ativo" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => onStatusChange(org.id, "suspenso")}
                                disabled={isStatusPending}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Suspender</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:bg-success/15"
                                onClick={() => onStatusChange(org.id, "ativo")}
                                disabled={isStatusPending}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Ativar</TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                      <PromoTriggerButton orgId={org.id} orgName={displayName} mode="actions" />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            disabled={isDeletePending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir organização</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir <strong>{displayName}</strong>? Esta ação é irreversível e apagará todos os dados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => onDelete(org.id)}
                            >
                              {isDeletePending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                              Excluir permanentemente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
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
