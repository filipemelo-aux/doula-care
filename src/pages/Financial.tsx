import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Plus, TrendingUp, Search, Trash2, Zap, Check, X, CheckCircle, CreditCard, Banknote, Building2, QrCode, FileText, Users, Wrench, UserPlus, DollarSign, Eye, Loader2, Pencil, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecordPaymentDialog } from "@/components/financial/RecordPaymentDialog";
import { RevenueDetailDialog } from "@/components/financial/RevenueDetailDialog";
import { PaymentMethodBadge } from "@/components/financial/PaymentMethodBadge";
import { maskCurrency, parseCurrency, maskPhone } from "@/lib/masks";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatBrazilDate, abbreviateName, toTitleCase } from "@/lib/utils";
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
  payment_method: z.enum(["pix", "cartao", "dinheiro", "transferencia", "boleto"]).optional(),
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

// Services come entirely from the database (custom_services table per org)

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
  const [revenueTab, setRevenueTab] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customServiceName, setCustomServiceName] = useState<string>("");
  const [showCustomService, setShowCustomService] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  const [entryAlreadyPaid, setEntryAlreadyPaid] = useState(false);
  const [customInstallmentAmounts, setCustomInstallmentAmounts] = useState<number[]>([]);
  const [customInstallmentDates, setCustomInstallmentDates] = useState<string[]>([]);
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
      payment_method: undefined,

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

  // Fetch all payment installments to compute due dates per transaction
  const { data: allPayments } = useQuery({
    queryKey: ["payments", "all-due-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("transaction_id, client_id, total_installments, due_date");
      if (error) throw error;
      return data || [];
    },
  });

  // Build a map: transaction.id -> last installment due_date (ISO string)
  const dueDateByTransaction = new Map<string, string>();
  if (allPayments && transactions) {
    const byTxId = new Map<string, string[]>();
    const byClientKey = new Map<string, string[]>(); // `${client_id}|${total_installments}`
    for (const p of allPayments) {
      if (!p.due_date) continue;
      if (p.transaction_id) {
        const arr = byTxId.get(p.transaction_id) || [];
        arr.push(p.due_date);
        byTxId.set(p.transaction_id, arr);
      } else if (p.client_id && p.total_installments != null) {
        const key = `${p.client_id}|${p.total_installments}`;
        const arr = byClientKey.get(key) || [];
        arr.push(p.due_date);
        byClientKey.set(key, arr);
      }
    }
    const maxOf = (arr: string[]) => arr.reduce((a, b) => (a > b ? a : b));
    for (const t of transactions) {
      const direct = byTxId.get(t.id);
      if (direct && direct.length > 0) {
        dueDateByTransaction.set(t.id, maxOf(direct));
        continue;
      }
      if (t.client_id) {
        const key = `${t.client_id}|${Number(t.installments || 1)}`;
        const fallback = byClientKey.get(key);
        if (fallback && fallback.length > 0) {
          dueDateByTransaction.set(t.id, maxOf(fallback));
        }
      }
    }
  }
  const getDueDate = (t: Transaction): string => dueDateByTransaction.get(t.id) || t.date;

  const { data: clients } = useQuery({
    queryKey: ["clients-with-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, plan, plan_value, plan_setting_id")
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

  // Fetch org custom services
  const { data: customServices } = useQuery({
    queryKey: ["custom-services", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const allServices = (customServices || []).map((s: any) => ({ id: s.id, name: s.name, icon: s.icon }));

  const addCustomServiceMutation = useMutation({
    mutationFn: async (serviceName: string) => {
      // Generate AI icon
      let icon = "🔧";
      try {
        const { data: fnData } = await supabase.functions.invoke("generate-service-icon", {
          body: { serviceName },
        });
        if (fnData?.icon) icon = fnData.icon;
      } catch { /* fallback icon */ }

      const { error } = await supabase
        .from("custom_services")
        .insert({ name: serviceName, organization_id: organizationId, icon });
      if (error) {
        if (error.code === "23505") return; // duplicate, ignore
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-services"] });
    },
  });

  const deleteCustomServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("custom_services")
        .delete()
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-services"] });
      toast.success("Serviço removido");
    },
    onError: () => {
      toast.error("Erro ao remover serviço");
    },
  });

  // Auto-fill when client is selected
  const handleClientChange = (clientId: string) => {
    form.setValue("client_id", clientId);
    const client = clients?.find((c) => c.id === clientId);
    if (client) {
      // Match by plan_setting_id first, then fallback to plan_type
      const plan = client.plan_setting_id 
        ? plans?.find((p) => p.id === client.plan_setting_id)
        : plans?.find((p) => p.plan_type === client.plan);
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
      const useCustomAmounts = data.installment_frequency === "manual" && customInstallmentAmounts.length === installments;
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

        for (let i = 0; i < installments; i++) {
          const thisInstVal = useCustomAmounts ? customInstallmentAmounts[i] : installmentValue;
          if (entryAlreadyPaid && i === 0) {
            autoReceived += thisInstVal;
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
        payment_method: null,

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

        const useCustomDates = data.installment_frequency === "manual" && customInstallmentDates.length === installments;

        const paymentRecords = Array.from({ length: installments }, (_, i) => {
          let dueDateStr: string;
          if (useCustomDates && customInstallmentDates[i]) {
            dueDateStr = customInstallmentDates[i];
          } else {
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
            dueDateStr = dueDate.toISOString().split("T")[0];
          }
          const thisInstVal = useCustomAmounts ? customInstallmentAmounts[i] : installmentValue;
          const isFirstPaid = entryAlreadyPaid && i === 0;
          return {
            client_id: data.client_id!,
            transaction_id: newTransaction.id,
            installment_number: i + 1,
            total_installments: installments,
            amount: thisInstVal,
            amount_paid: isFirstPaid ? thisInstVal : 0,
            due_date: dueDateStr,
            status: isFirstPaid ? "pago" : "pendente",
            paid_at: isFirstPaid ? new Date().toISOString() : null,
            owner_id: user?.id || null,
            organization_id: organizationId || null,
          };
        });

        const { error: paymentError } = await supabase.from("payments").insert(paymentRecords);
        if (paymentError) console.error("Error creating payments:", paymentError);
      }

      // When creating a service revenue (serviço avulso), also create service_requests + appointment for each service
      if (revenueTab === "servicos" && data.client_id && selectedServices.length > 0) {
        for (const svc of selectedServices) {
          await supabase.from("service_requests").insert({
            client_id: data.client_id,
            service_type: svc,
            status: "accepted",
            budget_value: data.amount / selectedServices.length,
            budget_sent_at: new Date().toISOString(),
            responded_at: new Date().toISOString(),
            organization_id: organizationId || null,
          });
        }

        // Create appointment so it appears in Agenda and client's reminders
        const serviceDate = new Date(data.date + "T10:00:00");
        await supabase.from("appointments").insert({
          client_id: data.client_id,
          title: `Serviço: ${selectedServices.join(", ")}`,
          scheduled_at: serviceDate.toISOString(),
          notes: data.notes || null,
          owner_id: user?.id || null,
          organization_id: organizationId || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-services"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments"] });
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
          description: data.description,
          amount: data.amount,
          date: data.date,
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
      // Get the transaction before deleting to check if it's a service
      const { data: tx } = await supabase
        .from("transactions")
        .select("description, client_id, date")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;

      // If it's a service transaction, also delete matching appointment
      if (tx && tx.description?.startsWith("Serviço:") && tx.client_id) {
        await supabase
          .from("appointments")
          .delete()
          .eq("client_id", tx.client_id)
          .eq("title", tx.description);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
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
    setSelectedServices([]);
    setCustomServiceName("");
    setShowCustomService(false);
    setShowQuickClient(false);
    setQuickClientName("");
    setQuickClientPhone("");
    setEntryAlreadyPaid(false);
    setAvistaPaymentStatus("pendente");
    setAvistaPartialValue("");
    setCustomInstallmentAmounts([]);
    setCustomInstallmentDates([]);
    form.reset({
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      payment_method: undefined,

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

  const handleEditTransaction = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setSelectedServices([]);
    setCustomServiceName("");
    setShowCustomService(false);
    setShowQuickClient(false);
    setAvistaPaymentStatus("pendente");
    setAvistaPartialValue("");

    const installments = Number(transaction.installments) || 1;
    let detectedFrequency: "semanal" | "quinzenal" | "mensal" | "manual" = "mensal";
    let detectedFirstDueDate = "";
    let detectedEntryPaid = false;
    let detectedCustomAmounts: number[] = [];
    let detectedCustomDates: string[] = [];

    // Fetch payment records to detect frequency, first due date and entry status
    if (installments > 1) {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, amount_paid, due_date, installment_number, total_installments")
        .eq("transaction_id", transaction.id)
        .order("installment_number", { ascending: true });

      if (payments && payments.length > 0) {
        detectedFirstDueDate = payments[0]?.due_date || "";
        detectedEntryPaid = Number(payments[0]?.amount_paid || 0) >= Number(payments[0]?.amount || 0) && Number(payments[0]?.amount || 0) > 0;

        // Detect frequency from date intervals
        if (payments.length >= 2 && payments[0]?.due_date && payments[1]?.due_date) {
          const d1 = new Date(payments[0].due_date + "T12:00:00");
          const d2 = new Date(payments[1].due_date + "T12:00:00");
          const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 6 && diffDays <= 8) detectedFrequency = "semanal";
          else if (diffDays >= 14 && diffDays <= 16) detectedFrequency = "quinzenal";
          else if (diffDays >= 28 && diffDays <= 32) detectedFrequency = "mensal";
          else detectedFrequency = "manual";
        }

        // Detect custom installment amounts
        const hasCustomAmounts = payments.some((p, _, arr) => Math.abs(Number(p.amount || 0) - Number(arr[0]?.amount || 0)) > 0.01);
        if (hasCustomAmounts) {
          detectedCustomAmounts = payments.map(p => Number(p.amount) || 0);
        }

        // Load individual due dates for manual frequency
        detectedCustomDates = payments.map(p => p.due_date || "");
      }
    }

    setEntryAlreadyPaid(detectedEntryPaid);
    setCustomInstallmentAmounts(detectedCustomAmounts);
    setCustomInstallmentDates(detectedCustomDates);

    form.reset({
      description: transaction.description,
      amount: Number(transaction.amount),
      date: transaction.date,
      client_id: transaction.client_id || undefined,
      plan_id: transaction.plan_id || undefined,
      payment_method: (transaction.payment_method as any) || "pix",
      payment_status: "a_receber",
      notes: transaction.notes || "",
      payment_type: installments > 1 ? "parcelado" : "a_vista",
      installments,
      installment_frequency: detectedFrequency,
      custom_interval_days: 30,
      first_due_date: detectedFirstDueDate,
      installment_value: Number(transaction.installment_value) || 0,
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
          plan: "avulso",
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
    setSelectedServices(prev => {
      const updated = prev.includes(serviceName) 
        ? prev.filter(s => s !== serviceName) 
        : [...prev, serviceName];
      form.setValue("description", updated.length > 0 ? `Serviço: ${updated.join(", ")}` : "");
      return updated;
    });
    setShowCustomService(false);
    setCustomServiceName("");
  };

  const handleCustomServiceConfirm = () => {
    if (customServiceName.trim()) {
      const name = customServiceName.trim();
      setSelectedServices(prev => {
        const updated = [...prev, name];
        form.setValue("description", `Serviço: ${updated.join(", ")}`);
        return updated;
      });
      // Save as custom service for future use
      addCustomServiceMutation.mutate(name);
      setShowCustomService(false);
      setCustomServiceName("");
    }
  };

  // Separate contract revenues from service revenues
  // Contratos: auto-generated from client registration (has plan_id OR description starts with "Contrato")
  // Serviços: everything else (manual entries, service requests)
  const isContractTransaction = (t: Transaction) =>
    t.is_auto_generated === true && (t.plan_id != null || t.description?.startsWith("Contrato"));

  // Receipt status helpers — prioritize ordering: a receber → parcial → recebido
  const getReceiptStatus = (t: Transaction): "a_receber" | "parcial" | "recebido" => {
    const total = Number(t.amount) || 0;
    const received = Number(t.amount_received) || 0;
    if (received <= 0) return "a_receber";
    if (received < total) return "parcial";
    return "recebido";
  };
  const receiptOrder: Record<string, number> = { a_receber: 0, parcial: 1, recebido: 2 };
  const sortByReceiptStatus = (a: Transaction, b: Transaction) => {
    const diff = receiptOrder[getReceiptStatus(a)] - receiptOrder[getReceiptStatus(b)];
    if (diff !== 0) return diff;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  };

  const clientTransactions = (transactions?.filter(isContractTransaction) || []).sort(sortByReceiptStatus);
  const serviceTransactions = (transactions?.filter((t) => !isContractTransaction(t)) || []).sort(sortByReceiptStatus);

  const allTransactions = [...(transactions || [])].sort(sortByReceiptStatus);
  const activeTabTransactions = revenueTab === "todos" ? allTransactions : revenueTab === "contratos" ? clientTransactions : serviceTransactions;

  const filteredTransactions = activeTabTransactions.filter(
    (t) =>
      (statusFilter === "todos" || getReceiptStatus(t) === statusFilter) &&
      (t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.clients?.full_name?.toLowerCase().includes(search.toLowerCase()))
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

      {/* Stats — Recebido como destaque */}
      <div className="rounded-2xl bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4 lg:p-6 shadow-card">
        <p className="text-xs text-muted-foreground/70 mb-0.5">Recebido</p>
        <p className="text-3xl lg:text-4xl font-bold tracking-tight text-success">{formatCurrency(totalReceived)}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Total contratado</p>
            <p className="text-sm lg:text-base font-semibold text-foreground/80">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">A receber</p>
            <p className="text-sm lg:text-base font-semibold text-amber-600/80">{formatCurrency(pendingIncome)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Transações</p>
            <p className="text-sm lg:text-base font-semibold text-foreground/80">{transactions?.length || 0}</p>
          </div>
        </div>
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
              <TabsTrigger value="todos" className="flex-1">
                Todos ({transactions?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contratos" className="flex-1">
                Contratos ({clientTransactions.length})
              </TabsTrigger>
              <TabsTrigger value="servicos" className="flex-1">
                Serviços ({serviceTransactions.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {(() => {
            const countBy = (s: string) => activeTabTransactions.filter((t) => getReceiptStatus(t) === s).length;
            const statusOptions: { value: string; label: string; dot?: string }[] = [
              { value: "todos", label: "Todos" },
              { value: "a_receber", label: "A receber", dot: "bg-destructive" },
              { value: "parcial", label: "Parciais", dot: "bg-amber-500" },
              { value: "recebido", label: "Recebidos", dot: "bg-emerald-500" },
            ];
            return (
              <div className="mt-3 flex w-full flex-nowrap justify-between gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {statusOptions.map((opt) => {
                  const active = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.dot && <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-2.5 p-3">
                {filteredTransactions.map((transaction) => {
                  const totalAmount = Number(transaction.amount) || 0;
                  const receivedAmount = Number(transaction.amount_received) || 0;
                  const pendingAmount = Math.max(0, totalAmount - receivedAmount);
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

                  const fullName = transaction.clients?.full_name || "";
                  const normalizedFullName = toTitleCase(fullName);
                  const firstName = normalizedFullName.split(" ")[0] || "";
                  const planName = transaction.plan_settings?.name || "";
                  const compactDesc = firstName && planName
                    ? `${firstName} - ${planName}`
                    : transaction.description;

                  const receiptStatus = getReceiptStatus(transaction);
                  const statusMeta: Record<string, { label: string; dot: string; text: string; bg: string }> = {
                    a_receber: { label: "A receber", dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10" },
                    parcial: { label: "Parcial", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
                    recebido: { label: "Recebido", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                  };
                  const sm = statusMeta[receiptStatus];

                  return (
                    <div
                      key={transaction.id}
                      className="relative rounded-2xl bg-card p-4 shadow-card transition-all active:scale-[0.99]"
                    >
                      {/* Top row: Info */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <p className="font-semibold text-sm text-foreground truncate leading-tight" title={compactDesc}>
                                {compactDesc}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 h-5 text-[10px] font-semibold flex-shrink-0 ${sm.bg} ${sm.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                              {sm.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">
                              {normalizedFullName ? abbreviateName(normalizedFullName) : "—"}
                            </span>
                            <span>•</span>
                            <span>{formatBrazilDate(transaction.date, "dd/MM/yy")}</span>
                          </p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mt-3 mb-3 h-px bg-border/50" />

                      {/* Values row */}
                      <div className="flex items-start w-full">
                        <div className="text-center min-w-0 flex-1 px-1">
                          <span className="text-[10px] text-muted-foreground block">Total</span>
                          <span className="font-semibold text-sm truncate block">{formatCompact(totalAmount)}</span>
                        </div>
                        <div className="text-center min-w-0 px-1" style={{flexBasis: '44px'}}>
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
                        <div className="text-center min-w-0 flex-1 px-1">
                          <span className="text-[10px] text-muted-foreground block">Receb.</span>
                          <span className="text-sm text-success font-medium">
                            {formatCompact(receivedAmount)}
                          </span>
                        </div>
                        <div className="text-center min-w-0 flex-1 px-1">
                          <span className="text-[10px] text-muted-foreground block">Pend.</span>
                          {pendingAmount > 0 ? (
                            <span className="text-sm text-warning font-medium truncate block">{formatCompact(pendingAmount)}</span>
                          ) : (
                            <span className="text-sm text-success font-medium">OK</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {pendingAmount > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPaymentDialog(transaction)}
                            className="flex-1 h-9 gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 text-xs font-medium"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Receber Pagamento
                          </Button>
                        ) : (
                          <div className="flex-1" />
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0 rounded-full bg-muted/40 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailDialog(transaction.id)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-95"
                            aria-label="Ver detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditTransaction(transaction)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-95"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(transaction.id)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>


              {/* Desktop Table */}
              <div className="hidden lg:block p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="w-[75px] text-xs font-medium text-muted-foreground py-2">Data</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-2">Cliente / Descrição</TableHead>
                      <TableHead className="w-[75px] text-xs font-medium text-muted-foreground py-2">DPP</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Valor</TableHead>
                      <TableHead className="text-center w-[55px] text-xs font-medium text-muted-foreground py-2">Parc.</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Recebido</TableHead>
                      <TableHead className="text-right w-[90px] text-xs font-medium text-muted-foreground py-2">Pendente</TableHead>
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
                          className="group hover:bg-muted/30 border-b transition-colors"
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
                                  {transaction.clients?.full_name ? toTitleCase(transaction.clients.full_name) : "—"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground truncate block max-w-[180px]" title={transaction.plan_settings?.name || transaction.description}>
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
                                className="text-xs text-muted-foreground cursor-pointer px-1.5 py-0.5 rounded border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5 transition-colors"
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
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPaymentDialog(transaction)}
                                    className="h-7 px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all text-xs font-medium"
                                  >
                                    <DollarSign className="h-3.5 w-3.5" />
                                    Registrar Pagamento
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Registrar pagamento</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(transaction)} className="h-7 px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-sm transition-all">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar receita</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleOpenDetailDialog(transaction.id)} className="h-7 px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-sm transition-all">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalhes</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(transaction.id)} className="h-7 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 hover:shadow-sm transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir</TooltipContent>
                              </Tooltip>
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
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-medium text-foreground/70 mb-1">Nenhuma receita ainda</p>
              <p className="text-sm text-muted-foreground/60 mb-6 text-center max-w-xs">Você ainda não registrou receitas. Comece a acompanhar seus ganhos.</p>
              <Button onClick={handleOpenDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                Registrar receita
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
                    <span className="font-medium">{selectedTransaction.clients?.full_name ? toTitleCase(selectedTransaction.clients.full_name) : "—"}</span>
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
                    {allServices.length > 0 ? (
                      <div className="max-h-[11rem] overflow-y-auto rounded-lg p-1">
                        <div className="grid grid-cols-3 gap-2">
                          {allServices.map((service) => (
                            <div key={service.id} className="relative group/service p-0.5">
                              <button
                                type="button"
                                onClick={() => handleSelectService(service.name)}
                                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-center transition-all w-full h-[4.5rem] ${
                                  selectedServices.includes(service.name)
                                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                                }`}
                              >
                                <span className="text-base leading-none">{service.icon}</span>
                                <span className="text-[11px] font-medium truncate w-full leading-tight">{service.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedServices.includes(service.name)) setSelectedServices(prev => prev.filter(s => s !== service.name));
                                  deleteCustomServiceMutation.mutate(service.id);
                                }}
                                className="absolute top-0 right-0 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/service:opacity-100 transition-opacity z-10"
                                title="Remover serviço"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhum serviço cadastrado. Clique abaixo para incluir.
                      </p>
                    )}

                    {/* Custom service */}
                    {!showCustomService ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed gap-1.5 text-xs"
                        onClick={() => {
                          setShowCustomService(true);
                          setSelectedServices([]);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Incluir serviço
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

                    {selectedServices.length > 0 && (
                      <p className="text-xs text-success flex items-center gap-1 min-w-0">
                        <CheckCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{selectedServices.length === 1 ? "Serviço selecionado" : `${selectedServices.length} serviços selecionados`}: <span className="font-medium">{selectedServices.join(", ")}</span></span>
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
                                  {toTitleCase(client.full_name)}
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
                        Cadastrar cliente avulsa
                      </Button>
                    ) : (
                      <div className="rounded-lg border-dashed bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                          <UserPlus className="h-3 w-3" />
                          Cadastro de Cliente Avulsa
                        </p>
                        <Input
                          placeholder="Nome completo"
                          value={quickClientName}
                          onChange={(e) => setQuickClientName(e.target.value)}
                          className="input-field h-8 text-sm"
                          autoFocus
                          mask="name"
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
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === "" ? "" : (parseInt(val) || 0));
                              }}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!val || val < 1) field.onChange(1);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {form.watch("installment_frequency") === "manual" && (form.watch("installments") || 1) > 1 && (
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-medium">Valores por parcela</FormLabel>
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            const count = form.watch("installments") || 1;
                            const total = form.watch("amount") || 0;
                            setCustomInstallmentAmounts(Array(count).fill(total / count));
                          }}
                        >
                          Dividir igualmente
                        </button>
                      </div>
                      {(() => {
                        const count = form.watch("installments") || 1;
                        const total = form.watch("amount") || 0;
                        const firstDue = form.watch("first_due_date");
                        const customDays = form.watch("custom_interval_days") || 30;

                        // Initialize amounts if needed
                        if (customInstallmentAmounts.length !== count) {
                          const equalVal = total / count;
                          const initial = Array(count).fill(equalVal);
                          if (customInstallmentAmounts.length === 0) {
                            setTimeout(() => setCustomInstallmentAmounts(initial), 0);
                          }
                          return null;
                        }

                        // Initialize dates if needed
                        if (customInstallmentDates.length !== count) {
                          const baseDateStr = firstDue || format(new Date(), "yyyy-MM-dd");
                          const baseDate = new Date(baseDateStr + "T12:00:00");
                          const dates = Array.from({ length: count }, (_, i) => {
                            const d = new Date(baseDate);
                            d.setDate(d.getDate() + (customDays * i));
                            return d.toISOString().split("T")[0];
                          });
                          setTimeout(() => setCustomInstallmentDates(dates), 0);
                          return null;
                        }

                        const sumCustom = customInstallmentAmounts.reduce((a, b) => a + b, 0);
                        const diff = Math.abs(sumCustom - total);
                        return (
                          <div className="space-y-1.5">
                            {customInstallmentAmounts.map((amt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}ª</span>
                                <Input
                                  className="input-field h-7 text-xs flex-1 min-w-0"
                                  value={maskCurrency(String(Math.round(amt * 100)))}
                                  onChange={(e) => {
                                    const newAmounts = [...customInstallmentAmounts];
                                    const newVal = parseCurrency(e.target.value);
                                    newAmounts[i] = newVal;
                                    const nextCount = count - 1 - i;
                                    if (nextCount > 0) {
                                      const sumPrevious = newAmounts.slice(0, i).reduce((a, b) => a + b, 0);
                                      const remaining = total - sumPrevious - newVal;
                                      const perNext = Math.max(0, remaining / nextCount);
                                      for (let j = i + 1; j < count; j++) {
                                        newAmounts[j] = Math.round(perNext * 100) / 100;
                                      }
                                      const sumAll = newAmounts.reduce((a, b) => a + b, 0);
                                      const roundDiff = total - sumAll;
                                      if (Math.abs(roundDiff) > 0.001) {
                                        newAmounts[count - 1] = Math.round((newAmounts[count - 1] + roundDiff) * 100) / 100;
                                      }
                                    }
                                    setCustomInstallmentAmounts(newAmounts);
                                  }}
                                  placeholder="R$ 0,00"
                                />
                                <Input
                                  type="date"
                                  className="input-field h-7 text-xs w-[130px] shrink-0"
                                  value={customInstallmentDates[i] || ""}
                                  onChange={(e) => {
                                    const newDates = [...customInstallmentDates];
                                    newDates[i] = e.target.value;
                                    setCustomInstallmentDates(newDates);
                                  }}
                                />
                              </div>
                            ))}
                            {diff > 0.01 && (
                              <p className="text-[10px] text-warning">
                                Soma das parcelas: {maskCurrency(String(Math.round(sumCustom * 100)))} (diferença de {maskCurrency(String(Math.round(diff * 100)))})
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
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
                <div className="rounded-lg p-3 space-y-2">
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
                <div className="rounded-lg p-3 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entryAlreadyPaid}
                      onChange={(e) => setEntryAlreadyPaid(e.target.checked)}
                      className="rounded "
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
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Salvando...
                    </>
                  ) : selectedTransaction ? "Atualizar" : "Registrar"}
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
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Excluindo...
                </>
              ) : "Excluir"}
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
