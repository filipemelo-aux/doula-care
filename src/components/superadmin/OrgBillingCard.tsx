import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Plus, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface BillingRow {
  id: string;
  organization_id: string;
  amount: number;
  billing_cycle: string;
  reference_month: string;
  status: string;
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

export function OrgBillingCard() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCycle, setNewCycle] = useState<"monthly" | "annual">("monthly");
  const [newRefMonth, setNewRefMonth] = useState(format(new Date(), "yyyy-MM"));
  const [newNotes, setNewNotes] = useState("");

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
        .order("reference_month", { ascending: false });

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

      const { error } = await supabase.from("org_billing").insert({
        organization_id: selectedOrg,
        amount,
        billing_cycle: newCycle,
        reference_month: `${newRefMonth}-01`,
        notes: newNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-billing"] });
      toast.success("Cobrança criada!");
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => toast.error("Erro ao criar cobrança"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "pago") updates.paid_at = new Date().toISOString();
      else updates.paid_at = null;

      const { error } = await supabase.from("org_billing").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-billing"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const resetForm = () => {
    setSelectedOrg("");
    setNewAmount("");
    setNewCycle("monthly");
    setNewRefMonth(format(new Date(), "yyyy-MM"));
    setNewNotes("");
  };

  // Auto-fill amount when org selected
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
    }
  };

  const getOrgName = (orgId: string) => orgs.find((o) => o.id === orgId)?.name || orgId.slice(0, 8);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case "atrasado":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>;
      case "cancelado":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalPending = billings
    .filter((b) => b.status === "pendente" || b.status === "atrasado")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const totalReceived = billings
    .filter((b) => b.status === "pago")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Cobranças
              </CardTitle>
              <CardDescription>Gerencie pagamentos das doulas</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Cobrança
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800/30">
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalReceived)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800/30">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-sm">
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

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : billings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma cobrança registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doula</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billings.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{getOrgName(bill.organization_id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(bill.reference_month + "T12:00:00"), "MMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(bill.amount))}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {bill.billing_cycle === "monthly" ? "Mensal" : "Anual"}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.status)}</TableCell>
                      <TableCell>
                        <Select
                          value={bill.status}
                          onValueChange={(status) =>
                            updateStatusMutation.mutate({ id: bill.id, status })
                          }
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                            <SelectItem value="atrasado">Atrasado</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                  className="h-9 text-sm lowercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Valor</Label>
              <Input
                value={newAmount}
                onChange={(e) => setNewAmount(maskCurrency(e.target.value))}
                placeholder="R$ 0,00"
                className="h-9 text-sm lowercase"
              />
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
