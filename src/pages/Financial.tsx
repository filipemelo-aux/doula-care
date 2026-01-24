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
import { Plus, TrendingUp, Search, Trash2, Edit2, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function Financial() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
          description: data.description,
          amount: data.amount,
          date: data.date,
          client_id: data.client_id || null,
          plan_id: data.plan_id || null,
          payment_method: data.payment_method,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
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

  const onSubmit = (data: TransactionFormData) => {
    if (selectedTransaction) {
      updateMutation.mutate({ ...data, id: selectedTransaction.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    form.reset({
      description: transaction.description,
      amount: Number(transaction.amount),
      date: transaction.date,
      client_id: transaction.client_id || undefined,
      plan_id: transaction.plan_id || undefined,
      payment_method: (transaction.payment_method as "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto") || "pix",
      payment_status: "recebido",
      notes: transaction.notes || "",
    });
    setDialogOpen(true);
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

  const pendingIncome = clients
    ?.filter((c) => c.plan_value && Number(c.plan_value) > 0)
    .reduce((sum, c) => sum + Number(c.plan_value || 0), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Financeiro - Receitas</h1>
          <p className="page-description">Controle suas receitas e recebimentos</p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Receita
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Receita Total"
          value={formatCurrency(totalIncome)}
          subtitle="Todas as receitas"
          icon={Wallet}
          variant="success"
        />
        <StatCard
          title="Este Mês"
          value={formatCurrency(thisMonthIncome)}
          subtitle={format(new Date(), "MMMM yyyy", { locale: ptBR })}
          icon={Calendar}
        />
        <StatCard
          title="A Receber"
          value={formatCurrency(pendingIncome)}
          subtitle="Planos contratados"
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
        <CardContent className="pt-6">
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

      {/* Table */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Receitas ({filteredTransactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="table-row-hover">
                      <TableCell>
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {transaction.is_auto_generated && (
                            <span title="Gerado automaticamente">
                              <Zap className="w-3 h-3 text-warning" />
                            </span>
                          )}
                          {transaction.description}
                        </div>
                      </TableCell>
                      <TableCell>{transaction.clients?.full_name || "—"}</TableCell>
                      <TableCell>{transaction.plan_settings?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {paymentMethodLabels[(transaction.payment_method as keyof typeof paymentMethodLabels) || "pix"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-success/15 text-success hover:bg-success/20">
                          {formatCurrency(Number(transaction.amount))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(transaction)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction.id)}
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
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {selectedTransaction ? "Editar Receita" : "Nova Receita"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="input-field"
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
                    <FormItem>
                      <FormLabel>Data *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="input-field" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field">
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
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="input-field">
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
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[80px] resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
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
