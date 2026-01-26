import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, TrendingUp, Search, Trash2, Zap, Check, X, CheckCircle, CreditCard, Banknote, Building2, QrCode, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatBrazilDate } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { Wallet, Calendar, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions"> & {
  clients?: { full_name: string } | null;
  plan_settings?: { name: string } | null;
};

const paymentMethodLabels = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

const paymentStatusLabels = {
  recebido: "Recebido",
  a_receber: "A Receber",
  parcial: "Parcial",
};

const transactionSchema = z.object({
  description: z.string().min(2, "Descrição obrigatória").max(200),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  date: z.string().min(1, "Data obrigatória"),
  client_id: z.string().optional(),
  plan_id: z.string().optional(),
  payment_method: z.enum(["pix", "cartao", "dinheiro", "transferencia", "boleto"]),
  payment_status: z.enum(["recebido", "a_receber", "parcial"]),
  notes: z.string().optional(),
  installments: z.number().min(1).max(24).default(1),
  installment_value: z.number().min(0).default(0),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function Financial() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingReceivedId, setEditingReceivedId] = useState<string | null>(null);
  const [editingReceivedValue, setEditingReceivedValue] = useState<string>("");
  const [editingInstallmentsId, setEditingInstallmentsId] = useState<string | null>(null);
  const [editingInstallmentsValue, setEditingInstallmentsValue] = useState<string>("");

  const queryClient = useQueryClient();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "pix",
      payment_status: "a_receber",
      notes: "",
      installments: 1,
      installment_value: 0,
    },
  });

  const selectedClientId = form.watch("client_id");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", "receita"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, clients(full_name), plan_settings(name)")
        .eq("type", "receita")
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-with-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, plan, plan_value")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["plan-settings-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-fill when client is selected
  const handleClientChange = (clientId: string) => {
    form.setValue("client_id", clientId);
    const client = clients?.find((c) => c.id === clientId);
    if (client) {
      const plan = plans?.find((p) => p.plan_type === client.plan);
      if (plan) {
        form.setValue("plan_id", plan.id);
        form.setValue("amount", Number(client.plan_value) || Number(plan.default_value));
        form.setValue("description", `Pagamento - ${plan.name}`);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const { error } = await supabase.from("transactions").insert({
        type: "receita",
        description: data.description,
        amount: data.amount,
        date: data.date,
        client_id: data.client_id || null,
        plan_id: data.plan_id || null,
        payment_method: data.payment_method,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Receita registrada!");
      setDialogOpen(false);
      form.reset();
      setSelectedTransaction(null);
    },
    onError: () => {
      toast.error("Erro ao registrar receita");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: TransactionFormData & { id: string }) => {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: data.amount,
          date: data.date,
          payment_method: data.payment_method,
          notes: data.notes || null,
          installments: data.installments,
          installment_value: data.installment_value,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Receita atualizada!");
      setDialogOpen(false);
      form.reset();
      setSelectedTransaction(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar receita");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Receita excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir receita");
    },
  });

  const updateReceivedMutation = useMutation({
    mutationFn: async ({ id, amountReceived }: { id: string; amountReceived: number }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ amount_received: amountReceived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Valor recebido atualizado!");
      setEditingReceivedId(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar valor");
    },
  });

  const updateInstallmentsMutation = useMutation({
    mutationFn: async ({ id, installments, installmentValue }: { id: string; installments: number; installmentValue: number }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ installments, installment_value: installmentValue })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Parcelas atualizadas!");
      setEditingInstallmentsId(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar parcelas");
    },
  });

  const updatePaymentMethodMutation = useMutation({
    mutationFn: async ({ id, paymentMethod }: { id: string; paymentMethod: "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto" }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ payment_method: paymentMethod })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Forma de pagamento atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar forma de pagamento");
    },
  });

  const handleStartEditReceived = (transaction: Transaction) => {
    setEditingReceivedId(transaction.id);
    setEditingReceivedValue(String(Number(transaction.amount_received) || 0));
    // Cancel any other editing
    setEditingInstallmentsId(null);
  };

  const handleSaveReceived = (transactionId: string, totalAmount: number) => {
    const value = parseFloat(editingReceivedValue.replace(",", ".")) || 0;
    const clampedValue = Math.min(Math.max(0, value), totalAmount);
    updateReceivedMutation.mutate({ id: transactionId, amountReceived: clampedValue });
  };

  const handleCancelEditReceived = () => {
    setEditingReceivedId(null);
    setEditingReceivedValue("");
  };

  const handleStartEditInstallments = (transaction: Transaction) => {
    setEditingInstallmentsId(transaction.id);
    setEditingInstallmentsValue(String(Number(transaction.installments) || 1));
    // Cancel any other editing
    setEditingReceivedId(null);
  };

  const handleSaveInstallments = (transactionId: string, totalAmount: number) => {
    const installments = Math.max(1, Math.min(24, parseInt(editingInstallmentsValue) || 1));
    const installmentValue = totalAmount / installments;
    updateInstallmentsMutation.mutate({ id: transactionId, installments, installmentValue });
  };

  const handleCancelEditInstallments = () => {
    setEditingInstallmentsId(null);
    setEditingInstallmentsValue("");
  };

  const handleMarkAsPaid = (transactionId: string, totalAmount: number) => {
    updateReceivedMutation.mutate({ id: transactionId, amountReceived: totalAmount });
  };

  const handleChangePaymentMethod = (transactionId: string, method: "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto") => {
    updatePaymentMethodMutation.mutate({ id: transactionId, paymentMethod: method });
  };

  const onSubmit = (data: TransactionFormData) => {
    if (selectedTransaction) {
      updateMutation.mutate({ ...data, id: selectedTransaction.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    setTransactionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteMutation.mutate(transactionToDelete);
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleOpenDialog = () => {
    setSelectedTransaction(null);
    form.reset({
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "pix",
      payment_status: "a_receber",
      notes: "",
    });
    setDialogOpen(true);
  };

  const filteredTransactions = transactions?.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.clients?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalIncome = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const thisMonthIncome =
    transactions
      ?.filter((t) => {
        const transactionDate = new Date(t.date);
        const now = new Date();
        return (
          transactionDate.getMonth() === now.getMonth() &&
          transactionDate.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Calculate pending income from transactions (amount - amount_received)
  const pendingIncome = transactions
    ?.reduce((sum, t) => {
      const total = Number(t.amount) || 0;
      const received = Number(t.amount_received) || 0;
      return sum + Math.max(0, total - received);
    }, 0) || 0;

  // Total received
  const totalReceived = transactions?.reduce((sum, t) => sum + (Number(t.amount_received) || 0), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6 lg:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Financeiro - Receitas</h1>
          <p className="page-description">Controle suas receitas e recebimentos</p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2 flex-shrink-0 w-full md:w-auto">
          <Plus className="w-4 h-4" />
          Nova Receita
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Receita Total"
          value={formatCurrency(totalIncome)}
          subtitle="Valor total contratado"
          icon={Wallet}
        />
        <StatCard
          title="Recebido"
          value={formatCurrency(totalReceived)}
          subtitle="Já recebido"
          icon={Calendar}
          variant="success"
        />
        <StatCard
          title="A Receber"
          value={formatCurrency(pendingIncome)}
          subtitle="Pagamentos pendentes"
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Transações"
          value={transactions?.length || 0}
          subtitle="Total de receitas"
          icon={TrendingUp}
        />
      </div>

      {/* Search */}
      <Card className="card-glass">
        <CardContent className="p-4 lg:pt-6 lg:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </CardContent>
      </Card>

      {/* Revenues List */}
      <Card className="card-glass">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-lg font-semibold text-foreground">
            Receitas ({filteredTransactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-2 px-3 py-2">
                {filteredTransactions.map((transaction) => {
                  const totalAmount = Number(transaction.amount) || 0;
                  const receivedAmount = Number(transaction.amount_received) || 0;
                  const pendingAmount = Math.max(0, totalAmount - receivedAmount);
                  const currentMethod = (transaction.payment_method as keyof typeof paymentMethodLabels) || "pix";
                  const installments = Number(transaction.installments) || 1;
                  const isEditingReceivedMobile = editingReceivedId === transaction.id;
                  const isEditingInstallmentsMobile = editingInstallmentsId === transaction.id;

                  const formatCompact = (value: number) => {
                    return new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(value);
                  };

                  // Get first name only
                  const firstName = transaction.clients?.full_name?.split(" ")[0]?.toUpperCase() || "";
                  const planName = transaction.plan_settings?.name || "";
                  const compactDesc = firstName && planName 
                    ? `Contrato - ${firstName} - ${planName}`
                    : transaction.description;

                  return (
                    <Card key={transaction.id} className="p-2 space-y-1.5 w-full max-w-full overflow-hidden">
                      {/* Header: Description + Actions */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {transaction.is_auto_generated && (
                            <Zap className="w-3 h-3 text-warning flex-shrink-0" />
                          )}
                          <p className="font-medium text-sm truncate">{compactDesc}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(transaction.id)}
                          className="h-6 w-6 text-destructive flex-shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Info: Client + Date */}
                      <p className="text-xs text-muted-foreground truncate">
                        {transaction.clients?.full_name || "—"} • {formatBrazilDate(transaction.date, "dd/MM/yy")}
                      </p>

                      {/* Values: Grid layout - compact */}
                      <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-border/50">
                        <div className="text-center min-w-0">
                          <span className="text-[10px] text-muted-foreground block">Total</span>
                          <span className="font-semibold text-sm">{formatCompact(totalAmount)}</span>
                        </div>
                        <div className="text-center min-w-0">
                          <span className="text-[10px] text-muted-foreground block">Parc.</span>
                          {isEditingInstallmentsMobile ? (
                            <Input
                              type="number"
                              value={editingInstallmentsValue}
                              onChange={(e) => setEditingInstallmentsValue(e.target.value)}
                              className="w-full h-6 text-center text-sm px-0.5"
                              min={1}
                              max={24}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveInstallments(transaction.id, totalAmount);
                                } else if (e.key === "Escape") {
                                  handleCancelEditInstallments();
                                }
                              }}
                              onBlur={() => handleSaveInstallments(transaction.id, totalAmount)}
                            />
                          ) : (
                            <span 
                              className="text-sm font-medium cursor-pointer px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5 transition-colors"
                              onClick={() => handleStartEditInstallments(transaction)}
                            >
                              {installments}x
                            </span>
                          )}
                        </div>
                        <div className="text-center min-w-0">
                          <span className="text-[10px] text-muted-foreground block">Receb.</span>
                          {isEditingReceivedMobile ? (
                            <Input
                              type="number"
                              value={editingReceivedValue}
                              onChange={(e) => setEditingReceivedValue(e.target.value)}
                              className="w-full h-6 text-center text-sm px-0.5"
                              min={0}
                              max={totalAmount}
                              step="0.01"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveReceived(transaction.id, totalAmount);
                                } else if (e.key === "Escape") {
                                  handleCancelEditReceived();
                                }
                              }}
                              onBlur={() => handleSaveReceived(transaction.id, totalAmount)}
                            />
                          ) : (
                            <span 
                              className="text-sm text-success font-medium cursor-pointer px-1.5 py-0.5 rounded border border-dashed border-success/40 hover:border-success hover:bg-success/5 transition-colors"
                              onClick={() => handleStartEditReceived(transaction)}
                            >
                              {formatCompact(receivedAmount)}
                            </span>
                          )}
                        </div>
                        <div className="text-center min-w-0">
                          <span className="text-[10px] text-muted-foreground block">Pend.</span>
                          {pendingAmount > 0 ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="text-sm text-warning font-medium">{formatCompact(pendingAmount)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMarkAsPaid(transaction.id, totalAmount)}
                                className="h-4 w-4 text-success p-0"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-success font-medium">OK</span>
                          )}
                        </div>
                      </div>

                      {/* Payment method icons */}
                      <div className="flex items-center justify-center gap-0 pt-1.5 border-t border-border/50">
                        <Button
                          variant={currentMethod === "pix" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => handleChangePaymentMethod(transaction.id, "pix")}
                          className="h-6 w-6"
                        >
                          <QrCode className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={currentMethod === "cartao" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => handleChangePaymentMethod(transaction.id, "cartao")}
                          className="h-6 w-6"
                        >
                          <CreditCard className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={currentMethod === "dinheiro" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => handleChangePaymentMethod(transaction.id, "dinheiro")}
                          className="h-6 w-6"
                        >
                          <Banknote className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={currentMethod === "transferencia" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => handleChangePaymentMethod(transaction.id, "transferencia")}
                          className="h-6 w-6"
                        >
                          <Building2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={currentMethod === "boleto" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => handleChangePaymentMethod(transaction.id, "boleto")}
                          className="h-6 w-6"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="w-[75px] text-xs font-medium text-muted-foreground py-2">Data</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-2">Cliente / Descrição</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Valor</TableHead>
                      <TableHead className="text-center w-[55px] text-xs font-medium text-muted-foreground py-2">Parc.</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Recebido</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Pendente</TableHead>
                      <TableHead className="w-[130px] text-xs font-medium text-muted-foreground py-2 text-center">Pagamento</TableHead>
                      <TableHead className="w-[36px] py-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const totalAmount = Number(transaction.amount) || 0;
                      const receivedAmount = Number(transaction.amount_received) || 0;
                      const pendingAmount = Math.max(0, totalAmount - receivedAmount);
                      const isEditingReceived = editingReceivedId === transaction.id;
                      const isEditingInstallments = editingInstallmentsId === transaction.id;
                      const currentMethod = (transaction.payment_method as keyof typeof paymentMethodLabels) || "pix";
                      const installments = Number(transaction.installments) || 1;
                      const isPaid = pendingAmount === 0;

                      return (
                        <TableRow 
                          key={transaction.id} 
                          className="group hover:bg-muted/30 border-b border-border/30 transition-colors"
                        >
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {formatBrazilDate(transaction.date, "dd/MM/yy")}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {transaction.is_auto_generated && (
                                  <Zap className="w-3 h-3 text-warning flex-shrink-0" />
                                )}
                                <span className="font-medium text-sm text-foreground">
                                  {transaction.clients?.full_name || "—"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {transaction.plan_settings?.name || transaction.description}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <span className="font-semibold text-sm">{formatCurrency(totalAmount)}</span>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {isEditingInstallments ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <Input
                                  type="number"
                                  value={editingInstallmentsValue}
                                  onChange={(e) => setEditingInstallmentsValue(e.target.value)}
                                  className="w-10 h-6 text-center text-xs px-1"
                                  min={1}
                                  max={24}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveInstallments(transaction.id, totalAmount);
                                    } else if (e.key === "Escape") {
                                      handleCancelEditInstallments();
                                    }
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveInstallments(transaction.id, totalAmount)}
                                  className="h-5 w-5 text-success"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span 
                                className="text-xs text-muted-foreground cursor-pointer px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5 transition-colors"
                                onClick={() => handleStartEditInstallments(transaction)}
                              >
                                {installments}x
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            {isEditingReceived ? (
                              <div className="flex items-center justify-end gap-0.5">
                                <Input
                                  type="number"
                                  value={editingReceivedValue}
                                  onChange={(e) => setEditingReceivedValue(e.target.value)}
                                  className="w-20 h-6 text-right text-xs px-1"
                                  min={0}
                                  max={totalAmount}
                                  step="0.01"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveReceived(transaction.id, totalAmount);
                                    } else if (e.key === "Escape") {
                                      handleCancelEditReceived();
                                    }
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveReceived(transaction.id, totalAmount)}
                                  className="h-5 w-5 text-success"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span 
                                className="text-xs text-success font-medium cursor-pointer px-1.5 py-0.5 rounded border border-dashed border-success/40 hover:border-success hover:bg-success/5 transition-colors"
                                onClick={() => handleStartEditReceived(transaction)}
                              >
                                {formatCurrency(receivedAmount)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            {pendingAmount > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-warning font-medium">
                                  {formatCurrency(pendingAmount)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMarkAsPaid(transaction.id, totalAmount)}
                                  className="h-5 w-5 text-success hover:bg-success/10"
                                  title="Marcar como quitado"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-success/70 font-medium">Quitado</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center justify-center gap-0">
                              {[
                                { method: "pix", icon: QrCode, label: "Pix" },
                                { method: "cartao", icon: CreditCard, label: "Cartão" },
                                { method: "dinheiro", icon: Banknote, label: "Dinheiro" },
                                { method: "transferencia", icon: Building2, label: "Transf." },
                                { method: "boleto", icon: FileText, label: "Boleto" },
                              ].map(({ method, icon: Icon, label }) => (
                                <Button
                                  key={method}
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleChangePaymentMethod(transaction.id, method as any)}
                                  className={`h-6 w-6 ${currentMethod === method ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                  title={label}
                                >
                                  <Icon className="h-3 w-3" />
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(transaction.id)}
                              className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhuma receita encontrada
              </p>
              <Button onClick={handleOpenDialog} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Registrar primeira receita
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-display text-lg">
              {selectedTransaction ? "Editar Receita" : "Nova Receita"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {/* Info da transação (apenas visualização quando editando) */}
              {selectedTransaction && (
                <div className="bg-muted/50 rounded-md p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{selectedTransaction.clients?.full_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plano:</span>
                    <span className="font-medium">{selectedTransaction.plan_settings?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descrição:</span>
                    <span className="font-medium truncate max-w-[180px]">{selectedTransaction.description}</span>
                  </div>
                </div>
              )}

              {/* Campos para nova receita */}
              {!selectedTransaction && (
                <>
                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select
                          onValueChange={(value) => handleClientChange(value)}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="input-field">
                              <SelectValue placeholder="Selecione uma cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Ao selecionar uma cliente, o plano e valor são preenchidos automaticamente
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plano</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field">
                              <SelectValue placeholder="Selecione um plano" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {plans?.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - {formatCurrency(Number(plan.default_value))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição *</FormLabel>
                        <FormControl>
                          <Input {...field} className="input-field" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Campos editáveis */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Valor Total (R$) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            field.onChange(value);
                            const installments = form.getValues("installments") || 1;
                            form.setValue("installment_value", value / installments);
                          }}
                          className="input-field h-8 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Data *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="input-field h-8 text-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Parcelamento */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="installments"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Nº de Parcelas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          {...field}
                          onChange={(e) => {
                            const installments = Math.max(1, Number(e.target.value));
                            field.onChange(installments);
                            const amount = form.getValues("amount") || 0;
                            form.setValue("installment_value", amount / installments);
                          }}
                          className="input-field h-8 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="installment_value"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Valor da Parcela (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="input-field h-8 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Forma de Pagamento *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(paymentMethodLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!selectedTransaction && (
                  <FormField
                    control={form.control}
                    name="payment_status"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(paymentStatusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[50px] resize-none text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Salvando..."
                    : selectedTransaction
                    ? "Atualizar"
                    : "Registrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
