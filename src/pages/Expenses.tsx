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
import { Plus, TrendingDown, Search, Trash2, Edit2, Loader2 } from "lucide-react";
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
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function Expenses() {
  const { user, organizationId } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Transaction | null>(null);

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
      notes: "",
    },
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["transactions", "despesa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("type", "despesa")
        .order("date", { ascending: false });

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
      notes: "",
    });
    setDialogOpen(true);
  };

  const filteredExpenses = expenses?.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const thisMonthExpenses =
    expenses
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
  const categoryTotals = expenses?.reduce((acc, e) => {
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
          <h1 className="page-title">Despesas</h1>
          <p className="page-description">Controle suas despesas e gastos</p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <StatCard
          title="Despesas Total"
          value={formatCurrency(totalExpenses)}
          subtitle="Todas as despesas"
          icon={Wallet}
          variant="warning"
        />
        <StatCard
          title="Este Mês"
          value={formatCurrency(thisMonthExpenses)}
          subtitle={formatBrazilDate(new Date(), "MMMM yyyy")}
          icon={Calendar}
        />
        <StatCard
          title="Transações"
          value={expenses?.length || 0}
          subtitle="Total de despesas"
          icon={TrendingDown}
        />
        {topCategory ? (
          <Card className="stat-card overflow-hidden">
            <div className="space-y-2 min-w-0">
              <p className="text-xs lg:text-sm text-muted-foreground truncate">Maior Categoria</p>
              <p className="text-sm lg:text-lg font-semibold text-foreground truncate">
                {expenseCategories[topCategory[0] as keyof typeof expenseCategories] || topCategory[0]}
              </p>
              <p className="text-lg lg:text-2xl font-bold text-primary truncate">
                {formatCurrency(topCategory[1])}
              </p>
            </div>
          </Card>
        ) : (
          <Card className="stat-card overflow-hidden">
            <div className="space-y-2 min-w-0">
              <p className="text-xs lg:text-sm text-muted-foreground">Maior Categoria</p>
              <p className="text-sm lg:text-lg font-semibold text-foreground">—</p>
            </div>
          </Card>
        )}
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
            Despesas ({filteredExpenses?.length || 0})
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                          className="h-7 w-7"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(expense)}
                              className="h-8 w-8"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(expense.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma despesa encontrada</p>
              <Button onClick={handleOpenDialog} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Registrar primeira despesa
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
              {selectedExpense ? "Editar Despesa" : "Nova Despesa"}
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
                      <FormLabel className="text-xs">Tipo de Despesa *</FormLabel>
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
