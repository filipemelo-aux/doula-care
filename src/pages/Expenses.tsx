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
import { Plus, TrendingDown, Search, Trash2, Edit2, Loader2, CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatBrazilDate } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { Wallet, Calendar } from "lucide-react";
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

type Transaction = Tables<"transactions">;

const expenseTypeLabels = {
  material_trabalho: "Material de Trabalho",
  servicos_contratados: "Serviços Contratados",
};

const expenseCategories = {
  social_media: "Social Media",
  filmmaker: "Filmmaker",
  marketing: "Marketing",
  material_hospitalar: "Material Hospitalar",
  material_escritorio: "Material de Escritório",
  transporte: "Transporte",
  formacao: "Formação",
  equipamentos: "Equipamentos",
  servicos_terceiros: "Serviços Terceiros",
  outros: "Outros",
};

const paymentMethodLabels = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
};

const expenseSchema = z.object({
  description: z.string().min(2, "Descrição obrigatória").max(200),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  date: z.string().min(1, "Data obrigatória"),
  expense_type: z.enum(["material_trabalho", "servicos_contratados"]),
  expense_category: z.enum([
    "social_media",
    "filmmaker",
    "marketing",
    "material_hospitalar",
    "material_escritorio",
    "transporte",
    "formacao",
    "equipamentos",
    "servicos_terceiros",
    "outros",
  ]),
  payment_method: z.enum(["pix", "cartao", "dinheiro", "transferencia", "boleto"]),
  payment_status: z.enum(["pendente", "pago"]),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpensesProps {
  view?: "payable" | "paid";
}

export default function Expenses({ view = "payable" }: ExpensesProps) {
  const isPaidView = view === "paid";
  const { user, organizationId, role } = useAuth();
  const isModerator = role === "moderator";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Transaction | null>(null);
  const [detailExpense, setDetailExpense] = useState<Transaction | null>(null);
  const [paymentAction, setPaymentAction] = useState<{ expense: Transaction; paid: boolean } | null>(null);

  const queryClient = useQueryClient();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      expense_type: "material_trabalho",
      expense_category: "outros",
      payment_method: "pix",
      payment_status: "pendente",
      notes: "",
    },
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["transactions", "despesa", isModerator ? user?.id : "all", view],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .eq("type", "despesa");
      if (isModerator && user?.id) q = q.eq("owner_id", user.id);
      const { data, error } = await q.order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const { error } = await supabase.from("transactions").insert({
        type: "despesa" as const,
        description: data.description,
        amount: data.amount,
        date: data.date,
        expense_type: data.expense_type,
        expense_category: data.expense_category,
        payment_method: data.payment_method,
        amount_received: data.payment_status === "pago" ? data.amount : 0,
        notes: data.notes || null,
        owner_id: user?.id || null,
        organization_id: organizationId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      toast.success("Despesa registrada!");
      setDialogOpen(false);
      form.reset();
      setSelectedExpense(null);
    },
    onError: () => {
      toast.error("Erro ao registrar despesa");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: ExpenseFormData & { id: string }) => {
      const { error } = await supabase
        .from("transactions")
        .update({
          description: data.description,
          amount: data.amount,
          date: data.date,
          expense_type: data.expense_type,
          expense_category: data.expense_category,
          payment_method: data.payment_method,
          amount_received: data.payment_status === "pago" ? data.amount : 0,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      toast.success("Despesa atualizada!");
      setDialogOpen(false);
      form.reset();
      setSelectedExpense(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar despesa");
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
      toast.success("Despesa excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir despesa");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ expense, paid }: { expense: Transaction; paid: boolean }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ amount_received: paid ? Number(expense.amount) : 0 })
        .eq("id", expense.id)
        .eq("type", "despesa");
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      toast.success(variables.paid ? "Conta marcada como paga" : "Pagamento estornado");
      setPaymentAction(null);
      setDetailExpense(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não foi possível atualizar a conta");
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    if (selectedExpense) {
      updateMutation.mutate({ ...data, id: selectedExpense.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (expense: Transaction) => {
    setSelectedExpense(expense);
    form.reset({
      description: expense.description,
      amount: Number(expense.amount),
      date: expense.date,
      expense_type: (expense.expense_type as "material_trabalho" | "servicos_contratados") || "material_trabalho",
      expense_category: (expense.expense_category as keyof typeof expenseCategories) || "outros",
      payment_method: (expense.payment_method as keyof typeof paymentMethodLabels) || "pix",
      payment_status: Number(expense.amount_received || 0) >= Number(expense.amount) ? "pago" : "pendente",
      notes: expense.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      deleteMutation.mutate(expenseToDelete);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleOpenDialog = () => {
    setSelectedExpense(null);
    form.reset({
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      expense_type: "material_trabalho",
      expense_category: "outros",
      payment_method: "pix",
      payment_status: "pendente",
      notes: "",
    });
    setDialogOpen(true);
  };

  const viewExpenses = expenses?.filter((expense) => {
    const paid = Number(expense.amount_received || 0) >= Number(expense.amount);
    return isPaidView ? paid : !paid;
  });
  const filteredExpenses = viewExpenses?.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = viewExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const thisMonthExpenses =
    viewExpenses
      ?.filter((e) => {
        const expenseDate = new Date(e.date);
        const now = new Date();
        return (
          expenseDate.getMonth() === now.getMonth() &&
          expenseDate.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  // Group by category for summary
  const categoryTotals = viewExpenses?.reduce((acc, e) => {
    const cat = e.expense_category || "outros";
    acc[cat] = (acc[cat] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>) || {};

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{isPaidView ? "Contas Pagas" : "Contas a Pagar"}</h1>
          <p className="page-description">
            {isPaidView ? "Consulte as contas quitadas e estorne pagamentos quando necessário" : "Organize as contas pendentes do seu negócio"}
          </p>
        </div>
        {!isPaidView && (
          <Button onClick={handleOpenDialog} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        )}
      </div>

      {/* Stats — Total como destaque */}
      <div className="rounded-2xl bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent p-4 lg:p-6 shadow-card">
        <p className="text-xs text-muted-foreground/70 mb-0.5">{isPaidView ? "Total pago" : "Total a pagar"}</p>
        <p className="text-3xl lg:text-4xl font-bold tracking-tight text-destructive">{formatCurrency(totalExpenses)}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Este mês</p>
            <p className="text-sm lg:text-base font-semibold text-foreground/80">{formatCurrency(thisMonthExpenses)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Transações</p>
            <p className="text-sm lg:text-base font-semibold text-foreground/80">{viewExpenses?.length || 0}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] lg:text-xs text-muted-foreground/60 font-normal">Maior categoria</p>
            <p className="text-sm lg:text-base font-semibold text-foreground/80 truncate">
              {topCategory ? (expenseCategories[topCategory[0] as keyof typeof expenseCategories] || topCategory[0]) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="card-glass">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            {isPaidView ? "Contas Pagas" : "Contas a Pagar"} ({filteredExpenses?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-3">
                {filteredExpenses.map((expense) => (
                  <Card key={expense.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBrazilDate(expense.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge className="bg-destructive/15 text-destructive text-xs">
                          -{formatCurrency(Number(expense.amount))}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {expenseTypeLabels[(expense.expense_type as keyof typeof expenseTypeLabels)] || "—"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {expenseCategories[(expense.expense_category as keyof typeof expenseCategories)] || "—"}
                        </Badge>
                      </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isPaidView ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => setDetailExpense(expense)} className="h-7 w-7" aria-label="Visualizar conta">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setPaymentAction({ expense, paid: false })} className="h-7 w-7 text-amber-700" aria-label="Estornar pagamento">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setPaymentAction({ expense, paid: true })} className="h-7 gap-1 text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                        </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="table-row-hover">
                        <TableCell>{formatBrazilDate(expense.date)}</TableCell>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {expenseTypeLabels[(expense.expense_type as keyof typeof expenseTypeLabels)] || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {expenseCategories[(expense.expense_category as keyof typeof expenseCategories)] || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {paymentMethodLabels[(expense.payment_method as keyof typeof paymentMethodLabels)] || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">
                            -{formatCurrency(Number(expense.amount))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-1">
                             {isPaidView ? (
                               <>
                                 <Button variant="ghost" size="icon" onClick={() => setDetailExpense(expense)} className="h-8 w-8" aria-label="Visualizar conta"><Eye className="h-4 w-4" /></Button>
                                 <Button variant="ghost" size="sm" onClick={() => setPaymentAction({ expense, paid: false })} className="h-8 gap-1 text-amber-700"><RotateCcw className="h-4 w-4" /> Estornar</Button>
                               </>
                             ) : (
                               <>
                                 <Button variant="ghost" size="sm" onClick={() => setPaymentAction({ expense, paid: true })} className="h-8 gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Pagar</Button>
                                 <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                                 <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                               </>
                             )}
                           </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-medium text-foreground/70 mb-1">{isPaidView ? "Nenhuma conta paga" : "Nenhuma conta pendente"}</p>
              <p className="text-sm text-muted-foreground/60 mb-6 text-center max-w-xs">
                {isPaidView ? "As contas quitadas aparecerão aqui." : "Você não possui contas a pagar no momento."}
              </p>
              {!isPaidView && <Button onClick={handleOpenDialog} className="gap-2"><Plus className="w-4 h-4" />Registrar conta</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-display text-lg">
              {selectedExpense ? "Editar Conta" : "Nova Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Descrição *</FormLabel>
                    <FormControl>
                      <Input {...field} className="input-field h-8 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="expense_type"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Tipo de Conta *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(expenseTypeLabels).map(([value, label]) => (
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
                  name="expense_category"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(expenseCategories).map(([value, label]) => (
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
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Valor (R$) *</FormLabel>
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
                name="payment_status"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Situação *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-field h-8 text-sm"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Já paga</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
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
                  ) : selectedExpense ? "Atualizar" : "Registrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailExpense} onOpenChange={(open) => !open && setDetailExpense(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalhes da Conta Paga</DialogTitle></DialogHeader>
          {detailExpense && (
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Descrição</p><p className="font-medium">{detailExpense.description}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Data</p><p>{formatBrazilDate(detailExpense.date)}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor pago</p><p className="font-semibold text-emerald-700">{formatCurrency(Number(detailExpense.amount))}</p></div>
                <div><p className="text-xs text-muted-foreground">Categoria</p><p>{expenseCategories[(detailExpense.expense_category as keyof typeof expenseCategories)] || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Forma de pagamento</p><p>{paymentMethodLabels[(detailExpense.payment_method as keyof typeof paymentMethodLabels)] || "—"}</p></div>
              </div>
              {detailExpense.notes && <div><p className="text-xs text-muted-foreground">Observações</p><p>{detailExpense.notes}</p></div>}
              <Button variant="outline" className="w-full gap-2 text-amber-700" onClick={() => setPaymentAction({ expense: detailExpense, paid: false })}>
                <RotateCcw className="h-4 w-4" /> Estornar pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paymentAction} onOpenChange={(open) => !open && setPaymentAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{paymentAction?.paid ? "Confirmar pagamento?" : "Estornar pagamento?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentAction?.paid
                ? "A conta será movida para Contas Pagas."
                : "A conta voltará para Contas a Pagar, sem perder os dados do lançamento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (paymentAction) paymentMutation.mutate(paymentAction);
              }}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? "Salvando..." : paymentAction?.paid ? "Confirmar pagamento" : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
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
    </div>
  );
}
