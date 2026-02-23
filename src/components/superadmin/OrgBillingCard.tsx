import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Receipt, Plus, CheckCircle, Clock, AlertTriangle, XCircle, Bell,
  CalendarDays, Building2,
} from "lucide-react";
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface BillingRow {
  id: string;
  organization_id: string;
  amount: number;
  billing_cycle: string;
  reference_month: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface OrgBasic {
  id: string;
  name: string;
  plan: string;
  billing_cycle: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; badgeClass: string; label: string }> = {
  pago: {
    icon: <CheckCircle className="h-3 w-3" />,
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300/30",
    label: "Pago",
  },
  atrasado: {
    icon: <AlertTriangle className="h-3 w-3" />,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Atrasado",
  },
  cancelado: {
    icon: <XCircle className="h-3 w-3" />,
    badgeClass: "bg-muted text-muted-foreground",
    label: "Cancelado",
  },
  pendente: {
    icon: <Clock className="h-3 w-3" />,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300/30",
    label: "Pendente",
  },
};

export function OrgBillingCard() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCycle, setNewCycle] = useState<"monthly" | "annual">("monthly");
  const [newRefMonth, setNewRefMonth] = useState(format(new Date(), "yyyy-MM"));
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [notifyDoula, setNotifyDoula] = useState(true);

  const { data: orgs = [] } = useQuery({
    queryKey: ["billing-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, plan, billing_cycle")
        .neq("plan", "free")
        .eq("status", "ativo")
        .order("name");
      if (error) throw error;
      return data as OrgBasic[];
    },
  });

  const { data: pricing = [] } = useQuery({
    queryKey: ["platform-plan-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_pricing")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["org-billing", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("org_billing")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BillingRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const amount = parseCurrency(newAmount);
      if (!selectedOrg || amount <= 0) throw new Error("Dados inválidos");

      const { data: billing, error } = await supabase.from("org_billing").insert({
        organization_id: selectedOrg,
        amount,
        billing_cycle: newCycle,
        reference_month: `${newRefMonth}-01`,
        due_date: newDueDate || null,
        notes: newNotes || null,
        notify_on_create: notifyDoula,
      }).select("id").single();
      if (error) throw error;

      if (notifyDoula) {
        const dueDateText = newDueDate
          ? ` Vencimento: ${format(new Date(newDueDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}.`
          : "";
        const refText = format(new Date(`${newRefMonth}-01T12:00:00`), "MMMM/yyyy", { locale: ptBR });

        await supabase.from("org_notifications").insert({
          organization_id: selectedOrg,
          title: "Nova cobrança",
          message: `Cobrança de ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} referente a ${refText}.${dueDateText}`,
          type: "billing",
          billing_id: billing?.id || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-billing"] });
      toast.success("Cobrança criada" + (notifyDoula ? " e doula notificada!" : "!"));
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => toast.error("Erro ao criar cobrança"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, orgId }: { id: string; status: string; orgId: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "pago") updates.paid_at = new Date().toISOString();
      else updates.paid_at = null;

      const { error } = await supabase.from("org_billing").update(updates).eq("id", id);
      if (error) throw error;

      const statusLabels: Record<string, string> = {
        pago: "Pagamento confirmado",
        atrasado: "Pagamento em atraso",
        cancelado: "Cobrança cancelada",
        pendente: "Cobrança pendente",
      };

      await supabase.from("org_notifications").insert({
        organization_id: orgId,
        title: statusLabels[status] || "Atualização de cobrança",
        message: `O status da sua cobrança foi atualizado para: ${statusLabels[status] || status}.`,
        type: "billing",
        billing_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-billing"] });
      toast.success("Status atualizado e doula notificada!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const resetForm = () => {
    setSelectedOrg("");
    setNewAmount("");
    setNewCycle("monthly");
    setNewRefMonth(format(new Date(), "yyyy-MM"));
    setNewDueDate("");
    setNewNotes("");
    setNotifyDoula(true);
  };

  const handleOrgSelect = (orgId: string) => {
    setSelectedOrg(orgId);
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      const cycle = (org.billing_cycle as "monthly" | "annual") || "monthly";
      setNewCycle(cycle);
      const priceRow = pricing.find((p) => p.plan === org.plan && p.billing_cycle === cycle);
      if (priceRow && priceRow.price > 0) {
        setNewAmount(maskCurrency(String(priceRow.price * 100)));
      }
      if (!newDueDate) {
        const nextMonth = addMonths(new Date(), 1);
        setNewDueDate(format(nextMonth, "yyyy-MM-dd"));
      }
    }
  };

  const getOrgName = (orgId: string) => orgs.find((o) => o.id === orgId)?.name || orgId.slice(0, 8);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalPending = billings
    .filter((b) => b.status === "pendente" || b.status === "atrasado")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const totalReceived = billings
    .filter((b) => b.status === "pago")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const getStatusInfo = (status: string) => statusConfig[status] || statusConfig.pendente;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Cobranças ({billings.length})
          </h2>
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Cobrança
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-300/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-200/50 dark:bg-emerald-800/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalReceived)}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Recebido</p>
              </div>
            </CardContent>
          </Card>
          <Card className={totalPending > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-300/30" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalPending > 0 ? "bg-amber-200/50 dark:bg-amber-800/30" : "bg-muted"}`}>
                <Clock className={`h-5 w-5 ${totalPending > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalPending)}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Pendente</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : billings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma cobrança registrada
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {billings.map((bill) => {
              const isOverdue = bill.due_date && bill.status === "pendente" && new Date(bill.due_date + "T23:59:59") < new Date();
              const info = getStatusInfo(isOverdue ? "atrasado" : bill.status);
              const orgName = getOrgName(bill.organization_id);
              const initials = orgName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

              return (
                <Card
                  key={bill.id}
                  className={`group hover:shadow-md transition-all duration-200 border-border/60 ${isOverdue ? "border-destructive/40" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">{orgName}</h3>
                          <Badge variant="outline" className={`text-[10px] h-5 gap-0.5 ${info.badgeClass}`}>
                            {info.icon}
                            {info.label}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(Number(bill.amount))}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(bill.reference_month + "T12:00:00"), "MMM/yyyy", { locale: ptBR })}
                          </span>
                          {bill.due_date && (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                              {isOverdue && <AlertTriangle className="h-3 w-3" />}
                              Venc: {format(new Date(bill.due_date + "T12:00:00"), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/40">
                      <Select
                        value={bill.status}
                        onValueChange={(status) =>
                          updateStatusMutation.mutate({ id: bill.id, status, orgId: bill.organization_id })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="atrasado">Atrasado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create billing dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Doula</Label>
              <Select value={selectedOrg} onValueChange={handleOrgSelect}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione a doula" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.plan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ciclo</Label>
                <Select value={newCycle} onValueChange={(v) => setNewCycle(v as any)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mês Referência</Label>
                <Input
                  type="month"
                  value={newRefMonth}
                  onChange={(e) => setNewRefMonth(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input
                  value={newAmount}
                  onChange={(e) => setNewAmount(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Opcional"
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label className="text-sm font-normal">Notificar doula</Label>
              </div>
              <Switch checked={notifyDoula} onCheckedChange={setNotifyDoula} />
            </div>

            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!selectedOrg || !newAmount || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Cobrança"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
