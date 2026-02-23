import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, TrendingUp, Search, Trash2, Zap, Check, X, CheckCircle, CreditCard, Banknote, Building2, QrCode, FileText, Users, Wrench, UserPlus, DollarSign, Eye } from "lucide-react";
import { RecordPaymentDialog } from "@/components/financial/RecordPaymentDialog";
import { RevenueDetailDialog } from "@/components/financial/RevenueDetailDialog";
import { maskCurrency, parseCurrency, maskPhone } from "@/lib/masks";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatBrazilDate, abbreviateName } from "@/lib/utils";
// maskCurrency and parseCurrency already imported above
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
  clients?: { full_name: string; dpp: string | null } | null;
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
  payment_type: z.enum(["a_vista", "parcelado"]).default("a_vista"),
  installments: z.number().min(1).max(24).default(1),
  installment_frequency: z.enum(["semanal", "quinzenal", "mensal", "manual"]).default("mensal"),
  custom_interval_days: z.number().min(1).max(365).default(30),
  first_due_date: z.string().optional(),
  installment_value: z.number().min(0).default(0),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const predefinedServices = [
  { id: "taping", name: "Taping", icon: "✨" },
  { id: "ventosaterapia", name: "Ventosaterapia", icon: "☀️" },
  { id: "laserterapia", name: "Laserterapia", icon: "⚡" },
];

export default function Financial() {
  const { user, organizationId } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTransaction, setPaymentTransaction] = useState<Transaction | null>(null);
  const [editingInstallmentsId, setEditingInstallmentsId] = useState<string | null>(null);
  const [editingInstallmentsValue, setEditingInstallmentsValue] = useState<string>("");
  const [revenueTab, setRevenueTab] = useState<string>("clientes");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [customServiceName, setCustomServiceName] = useState<string>("");
  const [showCustomService, setShowCustomService] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  const [entryAlreadyPaid, setEntryAlreadyPaid] = useState(false);
  const [avistaPaymentStatus, setAvistaPaymentStatus] = useState<"pago" | "parcial" | "pendente">("pendente");
  const [avistaPartialValue, setAvistaPartialValue] = useState<string>("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

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

  // Determine if date-based auto-pay logic applies
  const watchedDate = form.watch("date");
  const watchedPaymentType = form.watch("payment_type");
  const watchedFirstDueDate = form.watch("first_due_date");
  
  const getRelevantDate = () => {
    if (watchedPaymentType === "parcelado" && watchedFirstDueDate) {
      return watchedFirstDueDate;
    }
    return watchedDate;
  };
  
  const relevantDate = getRelevantDate();
  const today = format(new Date(), "yyyy-MM-dd");
  const isDateInPast = relevantDate < today;
  const isDateTodayOrFuture = relevantDate >= today;

  const selectedClientId = form.watch("client_id");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", "receita"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, clients(full_name, dpp), plan_settings(name)")
        .eq("type", "receita")
        .order("created_at", { ascending: false });

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
      const installments = data.payment_type === "parcelado" ? (data.installments || 1) : 1;
      const installmentValue = data.amount / installments;

      // Determine amount_received based on payment type
      let autoReceived = 0;
      if (data.payment_type === "a_vista") {
        if (avistaPaymentStatus === "pago") {
          autoReceived = data.amount;
        } else if (avistaPaymentStatus === "parcial") {
          autoReceived = parseCurrency(avistaPartialValue) || 0;
        } else {
          autoReceived = 0;
        }
      } else {
        // Parcelado: calculate after building payment records to account for ALL paid installments
        const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
        const frequency = data.installment_frequency || "mensal";
        const customDays = data.custom_interval_days || 30;
        const todayStr = format(new Date(), "yyyy-MM-dd");

        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(firstDueDate);
          if (frequency === "semanal") dueDate.setDate(dueDate.getDate() + (7 * i));
          else if (frequency === "quinzenal") dueDate.setDate(dueDate.getDate() + (15 * i));
          else if (frequency === "manual") dueDate.setDate(dueDate.getDate() + (customDays * i));
          else dueDate.setMonth(dueDate.getMonth() + i);
          const dueDateStr = dueDate.toISOString().split("T")[0];
          const isPastDue = dueDateStr < todayStr;
          if (isPastDue || (entryAlreadyPaid && i === 0)) {
            autoReceived += installmentValue;
          }
        }
      }

      const { data: newTransaction, error } = await supabase.from("transactions").insert({
        type: "receita",
        description: data.description,
        amount: data.amount,
        amount_received: autoReceived,
        date: data.date,
        client_id: data.client_id || null,
        plan_id: data.plan_id || null,
        payment_method: data.payment_method,
        notes: data.notes || null,
        installments,
        installment_value: installmentValue,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      }).select("id").single();
      if (error) throw error;

      // Create payment records with due dates if parcelado
      if (data.payment_type === "parcelado" && installments > 1 && data.client_id) {
        const firstDueDate = data.first_due_date ? new Date(data.first_due_date + "T12:00:00") : new Date();
        const frequency = data.installment_frequency || "mensal";
        const customDays = data.custom_interval_days || 30;

        const paymentRecords = Array.from({ length: installments }, (_, i) => {
          const dueDate = new Date(firstDueDate);
          if (frequency === "semanal") {
            dueDate.setDate(dueDate.getDate() + (7 * i));
          } else if (frequency === "quinzenal") {
            dueDate.setDate(dueDate.getDate() + (15 * i));
          } else if (frequency === "manual") {
            dueDate.setDate(dueDate.getDate() + (customDays * i));
          } else {
            dueDate.setMonth(dueDate.getMonth() + i);
          }
          const dueDateStr = dueDate.toISOString().split("T")[0];
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const isPastDue = dueDateStr < todayStr;
          return {
            client_id: data.client_id!,
            transaction_id: newTransaction.id,
            installment_number: i + 1,
            total_installments: installments,
            amount: installmentValue,
            amount_paid: isPastDue || (entryAlreadyPaid && i === 0) ? installmentValue : 0,
            due_date: dueDateStr,
            status: isPastDue || (entryAlreadyPaid && i === 0) ? "pago" : "pendente",
            paid_at: isPastDue || (entryAlreadyPaid && i === 0) ? new Date().toISOString() : null,
            owner_id: user?.id || null,
            organization_id: organizationId || null,
          };
        });

        const { error: paymentError } = await supabase.from("payments").insert(paymentRecords);
        if (paymentError) console.error("Error creating payments:", paymentError);
      }
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

  // Removed: inline updateReceivedMutation - now handled by RecordPaymentDialog

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

  const handleOpenPaymentDialog = (transaction: Transaction) => {
    setPaymentTransaction(transaction);
    setPaymentDialogOpen(true);
  };

  const handleOpenDetailDialog = (transactionId: string) => {
    setDetailTransactionId(transactionId);
    setDetailDialogOpen(true);
  };

  const handleStartEditInstallments = (transaction: Transaction) => {
    setEditingInstallmentsId(transaction.id);
    setEditingInstallmentsValue(String(Number(transaction.installments) || 1));
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

  // Removed: handleMarkAsPaid - now handled by RecordPaymentDialog

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
    setSelectedService(null);
    setCustomServiceName("");
    setShowCustomService(false);
    setShowQuickClient(false);
    setQuickClientName("");
    setQuickClientPhone("");
    setEntryAlreadyPaid(false);
    setAvistaPaymentStatus("pendente");
    setAvistaPartialValue("");
    form.reset({
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "pix",
      payment_status: "a_receber",
      notes: "",
      payment_type: "a_vista",
      installments: 1,
      installment_frequency: "mensal",
      custom_interval_days: 30,
      first_due_date: "",
      installment_value: 0,
    });
    setDialogOpen(true);
  };

  const quickClientMutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          full_name: name,
          phone: phone,
          status: "gestante",
          plan: "basico",
          payment_method: "pix",
          payment_status: "pendente",
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        })
        .select("id, full_name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients-with-plans"] });
      form.setValue("client_id", data.id);
      setShowQuickClient(false);
      setQuickClientName("");
      setQuickClientPhone("");
      toast.success(`Cliente "${data.full_name}" cadastrada!`);
    },
    onError: () => {
      toast.error("Erro ao cadastrar cliente");
    },
  });

  const handleSelectService = (serviceName: string) => {
    setSelectedService(serviceName);
    setShowCustomService(false);
    setCustomServiceName("");
    form.setValue("description", `Serviço: ${serviceName}`);
  };

  const handleCustomServiceConfirm = () => {
    if (customServiceName.trim()) {
      setSelectedService(customServiceName.trim());
      form.setValue("description", `Serviço: ${customServiceName.trim()}`);
    }
  };

  // Separate client plan revenues from service/manual revenues
  // Client tab: has plan_id OR is auto-generated (contract-based)
  // Service tab: no plan_id AND not auto-generated (manual/service entries)
  const clientTransactions = transactions?.filter((t) => t.plan_id != null || t.is_auto_generated === true) || [];
  const serviceTransactions = (transactions?.filter((t) => t.plan_id == null && !t.is_auto_generated) || [])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeTabTransactions = revenueTab === "clientes" ? clientTransactions : serviceTransactions;

  const filteredTransactions = activeTabTransactions.filter(
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
    <div className="space-y-4 lg:space-y-8 w-full box-border">
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4 w-full">
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
        <CardContent className="p-2 lg:pt-6 lg:p-6">
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
      <Card className="card-glass w-full box-border">
        <CardHeader className="px-3 py-3 lg:p-6">
          <Tabs value={revenueTab} onValueChange={setRevenueTab} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="clientes" className="flex-1 gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Clientes ({clientTransactions.length})
              </TabsTrigger>
              <TabsTrigger value="servicos" className="flex-1 gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Serviços ({serviceTransactions.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-2 px-2 py-1 w-full box-border min-w-0">
                {filteredTransactions.map((transaction) => {
                  const totalAmount = Number(transaction.amount) || 0;
                  const receivedAmount = Number(transaction.amount_received) || 0;
                  const pendingAmount = Math.max(0, totalAmount - receivedAmount);
                  const currentMethod = (transaction.payment_method as keyof typeof paymentMethodLabels) || "pix";
                  const installments = Number(transaction.installments) || 1;
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
                    <Card key={transaction.id} className="px-2 py-1.5 space-y-1 w-full box-border min-w-0 overflow-hidden">
                      {/* Header: Description */}
                      <div className="flex items-center gap-0.5 min-w-0">
                        {transaction.is_auto_generated && (
                          <Zap className="w-3 h-3 text-warning flex-shrink-0" />
                        )}
                        <p className="font-medium text-sm truncate min-w-0">{compactDesc}</p>
                      </div>

                      {/* Info: Client + Date */}
                      <div className="flex items-center min-w-0 overflow-hidden">
                        <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                          {transaction.clients?.full_name ? abbreviateName(transaction.clients.full_name) : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">{formatBrazilDate(transaction.date, "dd/MM/yy")}</span>
                      </div>

                      {/* Values: flex layout */}
                      <div className="flex items-start pt-1.5 border-t border-border/50 w-full">
                        <div className="text-center min-w-0 flex-1 flex-shrink px-1">
                          <span className="text-[10px] text-muted-foreground block">Total</span>
                          <span className="font-semibold text-sm truncate block">{formatCompact(totalAmount)}</span>
                        </div>
                        <div className="text-center min-w-0 flex-shrink px-1" style={{flexBasis: '36px'}}>
                          <span className="text-[10px] text-muted-foreground block">Parc.</span>
                          {isEditingInstallmentsMobile ? (
                            <Select
                              value={editingInstallmentsValue}
                              onValueChange={(value) => {
                                setEditingInstallmentsValue(value);
                                const installments = parseInt(value);
                                const installmentValue = totalAmount / installments;
                                updateInstallmentsMutation.mutate({ id: transaction.id, installments, installmentValue });
                              }}
                            >
                              <SelectTrigger className="w-10 h-6 text-xs px-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                                  <SelectItem key={num} value={String(num)}>
                                    {num}x
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span 
                              className="text-sm font-medium cursor-pointer border-b border-dashed border-muted-foreground/40 hover:border-primary transition-colors"
                              onClick={() => handleStartEditInstallments(transaction)}
                            >
                              {installments}x
                            </span>
                          )}
                        </div>
                        <div className="text-center min-w-0 flex-1 flex-shrink px-1">
                          <span className="text-[10px] text-muted-foreground block">Receb.</span>
                          <span className="text-sm text-success font-medium">
                            {formatCompact(receivedAmount)}
                          </span>
                        </div>
                        <div className="text-center min-w-0 flex-1 flex-shrink px-1">
                          <span className="text-[10px] text-muted-foreground block">Pend.</span>
                          {pendingAmount > 0 ? (
                            <span className="text-sm text-warning font-medium truncate block">{formatCompact(pendingAmount)}</span>
                          ) : (
                            <span className="text-sm text-success font-medium">OK</span>
                          )}
                        </div>
                      </div>

                      {/* Payment method icons + details button */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <div className="flex items-center gap-0">
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
                        <div className="flex items-center gap-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPaymentDialog(transaction)}
                            className="h-6 w-6 text-success"
                            title="Lançar pagamento"
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetailDialog(transaction.id)}
                            className="h-6 w-6 text-muted-foreground"
                            title="Ver detalhes"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction.id)}
                            className="h-6 w-6 text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
                      <TableHead className="w-[75px] text-xs font-medium text-muted-foreground py-2">DPP</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Valor</TableHead>
                      <TableHead className="text-center w-[55px] text-xs font-medium text-muted-foreground py-2">Parc.</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Recebido</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Pendente</TableHead>
                      <TableHead className="w-[130px] text-xs font-medium text-muted-foreground py-2 text-center">Pagamento</TableHead>
                      <TableHead className="w-[80px] py-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const totalAmount = Number(transaction.amount) || 0;
                      const receivedAmount = Number(transaction.amount_received) || 0;
                      const pendingAmount = Math.max(0, totalAmount - receivedAmount);
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
                          <TableCell className="py-2.5 max-w-[200px]">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {transaction.is_auto_generated && (
                                  <Zap className="w-3 h-3 text-warning flex-shrink-0" />
                                )}
                                <span className="font-medium text-sm text-foreground truncate">
                                  {transaction.clients?.full_name || "—"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {transaction.plan_settings?.name || transaction.description.replace(/\s*-\s*Plano\s+/i, " - ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {(transaction.clients as any)?.dpp ? format(parseISO((transaction.clients as any).dpp), "dd/MM/yy") : "—"}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <span className="font-semibold text-sm">{formatCurrency(totalAmount)}</span>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {isEditingInstallments ? (
                              <Select
                                value={editingInstallmentsValue}
                                onValueChange={(value) => {
                                  setEditingInstallmentsValue(value);
                                  const installments = parseInt(value);
                                  const installmentValue = totalAmount / installments;
                                  updateInstallmentsMutation.mutate({ id: transaction.id, installments, installmentValue });
                                }}
                              >
                                <SelectTrigger className="w-14 h-6 text-xs mx-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                                    <SelectItem key={num} value={String(num)}>
                                      {num}x
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                            <span className="text-xs text-success font-medium">
                              {formatCurrency(receivedAmount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            {pendingAmount > 0 ? (
                              <span className="text-xs text-warning font-medium">
                                {formatCurrency(pendingAmount)}
                              </span>
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
                            <div className="flex items-center gap-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPaymentDialog(transaction)}
                                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Lançar pagamento"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDetailDialog(transaction.id)}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Ver detalhes"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(transaction.id)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-display text-lg">
              {selectedTransaction ? "Editar Receita" : "Nova Receita de Serviço"}
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

              {/* Seleção de serviço para nova receita */}
              {!selectedTransaction && (
                <>
                  <div className="space-y-2">
                    <FormLabel className="text-xs font-medium">Tipo de Serviço *</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {predefinedServices.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleSelectService(service.name)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all ${
                            selectedService === service.name
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <span className="text-lg">{service.icon}</span>
                          <span className="text-xs font-medium">{service.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom service */}
                    {!showCustomService ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed gap-1.5 text-xs"
                        onClick={() => {
                          setShowCustomService(true);
                          setSelectedService(null);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Outro serviço
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nome do serviço..."
                          value={customServiceName}
                          onChange={(e) => setCustomServiceName(e.target.value)}
                          className="input-field h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCustomServiceConfirm();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          onClick={handleCustomServiceConfirm}
                          disabled={!customServiceName.trim()}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setShowCustomService(false);
                            setCustomServiceName("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {selectedService && (
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Serviço selecionado: <span className="font-medium">{selectedService}</span>
                      </p>
                    )}
                  </div>

                  {/* Cliente (opcional) */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Cliente (opcional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="input-field h-8 text-sm">
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!showQuickClient ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed gap-1.5 text-xs"
                        onClick={() => setShowQuickClient(true)}
                      >
                        <UserPlus className="h-3 w-3" />
                        Cadastrar cliente rápida
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                          <UserPlus className="h-3 w-3" />
                          Cadastro Rápido de Cliente
                        </p>
                        <Input
                          placeholder="Nome completo"
                          value={quickClientName}
                          onChange={(e) => setQuickClientName(e.target.value)}
                          className="input-field h-8 text-sm"
                          autoFocus
                        />
                        <Input
                          placeholder="(00) 00000-0000"
                          value={quickClientPhone}
                          onChange={(e) => setQuickClientPhone(maskPhone(e.target.value))}
                          className="input-field h-8 text-sm"
                          maxLength={16}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (quickClientName.trim() && quickClientPhone.trim()) {
                                quickClientMutation.mutate({ name: quickClientName.trim(), phone: quickClientPhone.trim() });
                              }
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs flex-1 gap-1"
                            onClick={() => {
                              if (quickClientName.trim() && quickClientPhone.trim()) {
                                quickClientMutation.mutate({ name: quickClientName.trim(), phone: quickClientPhone.trim() });
                              }
                            }}
                            disabled={!quickClientName.trim() || !quickClientPhone.trim() || quickClientMutation.isPending}
                          >
                            <Check className="h-3 w-3" />
                            {quickClientMutation.isPending ? "Salvando..." : "Salvar"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setShowQuickClient(false);
                              setQuickClientName("");
                              setQuickClientPhone("");
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Campos editáveis */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Valor Total *</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ? maskCurrency(String(Math.round(field.value * 100))) : ""}
                          onChange={(e) => {
                            const numValue = parseCurrency(e.target.value);
                            field.onChange(numValue);
                            const installments = form.getValues("installments") || 1;
                            form.setValue("installment_value", numValue / installments);
                          }}
                          className="input-field h-8 text-sm"
                          placeholder="R$ 0,00"
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
                      <FormLabel className="text-xs">Data do Serviço *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="input-field h-8 text-sm" />
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
                <FormField
                  control={form.control}
                  name="payment_type"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Tipo de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="a_vista">À Vista</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("payment_type") === "parcelado" && (
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="installments"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Parcelas</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const inst = parseInt(value);
                            field.onChange(inst);
                            const amount = form.getValues("amount") || 0;
                            form.setValue("installment_value", amount / inst);
                          }}
                          value={String(field.value || 1)}
                        >
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={String(num)}>
                                {num}x {form.getValues("amount") ? `(${maskCurrency(String(Math.round((form.getValues("amount") / num) * 100)))})` : ""}
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
                    name="installment_frequency"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Frequência</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "mensal"}>
                          <FormControl>
                            <SelectTrigger className="input-field h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
                            <SelectItem value="quinzenal">Quinzenal (15 dias)</SelectItem>
                            <SelectItem value="mensal">Mensal</SelectItem>
                            <SelectItem value="manual">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("installment_frequency") === "manual" && (
                    <FormField
                      control={form.control}
                      name="custom_interval_days"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Intervalo (dias)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              className="input-field h-8 text-sm"
                              value={field.value || 30}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="first_due_date"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">1º Vencimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="input-field h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {!selectedTransaction && watchedPaymentType === "a_vista" && (
                <div className="rounded-lg border p-3 space-y-2">
                  <FormLabel className="text-xs font-medium">Status do Pagamento</FormLabel>
                  <Select
                    value={avistaPaymentStatus}
                    onValueChange={(val) => setAvistaPaymentStatus(val as "pago" | "parcial" | "pendente")}
                  >
                    <SelectTrigger className="input-field h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago Completo</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                  {avistaPaymentStatus === "parcial" && (
                    <div className="space-y-1">
                      <FormLabel className="text-xs">Valor Recebido</FormLabel>
                      <Input
                        value={avistaPartialValue}
                        onChange={(e) => setAvistaPartialValue(maskCurrency(e.target.value))}
                        className="input-field h-8 text-sm"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  )}
                </div>
              )}

              {!selectedTransaction && watchedPaymentType === "parcelado" && (
                <div className="rounded-lg border p-3 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entryAlreadyPaid}
                      onChange={(e) => setEntryAlreadyPaid(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-xs font-medium">Entrada já foi recebida?</span>
                  </label>
                </div>
              )}

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

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        transactionId={paymentTransaction?.id || null}
        transactionAmount={Number(paymentTransaction?.amount) || 0}
        transactionInstallments={Number(paymentTransaction?.installments) || 1}
        clientId={paymentTransaction?.client_id || null}
      />

      {/* Revenue Detail Dialog */}
      <RevenueDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        transactionId={detailTransactionId}
      />
    </div>
  );
}
