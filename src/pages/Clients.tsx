import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calculateCurrentPregnancyWeeks, calculateCurrentPregnancyDays, isPostTerm } from "@/lib/pregnancy";
import { supabase } from "@/integrations/supabase/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit2, Trash2, Eye, Loader2, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ClientDetailsDialog } from "@/components/clients/ClientDetailsDialog";
import { toast } from "sonner";
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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePlanNames } from "@/hooks/usePlanNames";
import { ClientLimitBanner } from "@/components/plan/UpgradeBanner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Client = Tables<"clients">;

const statusLabels = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Puérpera",
  outro: "Outro",
};

// Plan labels are now resolved dynamically via usePlanNames hook

const paymentStatusLabels = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

const formatClientName = (fullName: string, maxLength = 28) => {
  if (fullName.length <= maxLength) return fullName;
  return `${fullName.slice(0, maxLength)}...`;
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "gestante" | "lactante">("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const queryClient = useQueryClient();
  const { canAddClient, remainingClients, clientCount, limits } = usePlanLimits();
  const { getPlanName } = usePlanNames();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("dpp", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("delete-client-user", {
        body: { clientId: id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-accounts"] });
      toast.success("Cliente excluída com sucesso!", {
        description: data.warning || undefined,
      });
    },
    onError: (error) => {
      toast.error("Erro ao excluir cliente", {
        description: error.message,
      });
    },
  });

  const filteredClients = clients?.filter((client) => {
    const matchesSearch =
      client.full_name.toLowerCase().includes(search.toLowerCase()) ||
      client.phone.includes(search) ||
      (client.cpf && client.cpf.includes(search));
    const matchesStatus =
      statusFilter === "todas" ? true : client.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a: any, b: any) => {
    if (statusFilter === "lactante") {
      // Recém-puérperas primeiro (birth_date mais recente no topo)
      const ad = a.birth_date ? new Date(a.birth_date).getTime() : 0;
      const bd = b.birth_date ? new Date(b.birth_date).getTime() : 0;
      return bd - ad;
    }
    if (statusFilter === "todas") {
      // Prioridade: gestante > outro/tentante > lactante
      const rank = (s: string) => (s === "gestante" ? 0 : s === "lactante" ? 2 : 1);
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      if (a.status === "lactante" && b.status === "lactante") {
        const ad = a.birth_date ? new Date(a.birth_date).getTime() : 0;
        const bd = b.birth_date ? new Date(b.birth_date).getTime() : 0;
        return bd - ad;
      }
      // dpp asc (mais próxima no topo)
      const ad = a.dpp ? new Date(a.dpp).getTime() : Infinity;
      const bd = b.dpp ? new Date(b.dpp).getTime() : Infinity;
      return ad - bd;
    }
    return 0;
  });

  // On free plan, mark clients beyond the limit as inactive
  const maxClients = limits.maxClients;
  const isClientInactive = (index: number) => {
    if (maxClients === null) return false;
    return index >= maxClients;
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setDetailsOpen(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteMutation.mutate(clientToDelete.id);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedClient(null);
  };

  return (
    <div className="space-y-6 lg:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Clientes</h1>
          <p className="page-description">
            Gerencie suas clientes e acompanhamentos
          </p>
        </div>
        <Button
          onClick={() => {
            if (!canAddClient) {
              toast.error("Limite de gestantes atingido", {
                description: "Faça upgrade do seu plano para cadastrar mais gestantes.",
              });
              return;
            }
            setDialogOpen(true);
          }}
          className="gap-2 flex-shrink-0 w-full md:w-auto"
          variant={canAddClient ? "default" : "outline"}
        >
          <Plus className="w-4 h-4" />
          Nova Cliente
        </Button>
      </div>

      {/* Plan limit warning */}
      <ClientLimitBanner remaining={remainingClients} max={limits.maxClients} current={clientCount} />

      {/* Search */}
      <Card className="card-glass">
        <CardContent className="p-4 lg:pt-6 lg:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      <Card className="card-glass">
        <CardHeader className="p-4 lg:p-6 space-y-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            Lista de Clientes ({filteredClients?.length || 0})
          </CardTitle>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="gestante">Gestantes</TabsTrigger>
              <TabsTrigger value="lactante">Puérperas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClients && filteredClients.length > 0 ? (
            <>
              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-2.5 p-3">
                {filteredClients.map((client, index) => {
                  const inactive = isClientInactive(index);
                  const initials = client.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                  const paymentDot: Record<string, string> = {
                    pendente: "bg-destructive",
                    parcial: "bg-amber-500",
                    pago: "bg-emerald-500",
                  };
                  return (
                    <div
                      key={client.id}
                      className={cn(
                        "relative rounded-2xl bg-card p-4 shadow-card transition-all active:scale-[0.99]",
                        inactive && "opacity-50 pointer-events-none"
                      )}
                    >
                      {inactive && (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-[8px] px-1.5 h-4 z-10">
                          Inativa (limite do plano)
                        </Badge>
                      )}
                      {/* Top row: Info */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate leading-tight">{client.full_name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {client.phone}
                            </span>
                            {client.dpp && (
                              <span className="inline-flex items-center gap-1">
                                DPP: {format(parseISO(client.dpp), "dd/MM/yyyy")}
                              </span>
                            )}
                            <span
                              className={cn(
                                "badge-status inline-flex items-center text-[9px] font-semibold px-1.5 h-4 rounded-full",
                                `badge-${client.status}`
                              )}
                            >
                              {client.status === "outro" && (client as any).custom_status
                                ? (client as any).custom_status
                                : statusLabels[client.status as keyof typeof statusLabels]}
                            </span>
                            {client.status === "gestante" && !client.birth_occurred && client.dpp && (() => {
                              const w = calculateCurrentPregnancyWeeks(client.pregnancy_weeks, client.pregnancy_weeks_set_at, client.dpp);
                              const d = calculateCurrentPregnancyDays(client.dpp);
                              const post = isPostTerm(client.dpp);
                              if (w === null) return null;
                              return (
                                <span className={cn("font-semibold", post ? "text-destructive" : "text-primary")}>
                                  {post ? "Pós-Data " : ""}{w}s {d}d
                                </span>
                              );
                            })()}
                          </p>
                        </div>
                      </div>


                      {/* Divider */}
                      <div className="mt-3 mb-3 h-px bg-border/50" />

                      {/* Linha única: Plano + Pagamento + Ações */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 h-5 rounded-full bg-muted text-muted-foreground truncate">
                            {getPlanName(client.plan_setting_id, client.plan)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 h-5 rounded-full shrink-0",
                              `badge-${client.payment_status}`
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", paymentDot[client.payment_status] || "bg-muted-foreground")} />
                            {paymentStatusLabels[client.payment_status as keyof typeof paymentStatusLabels]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 rounded-full bg-muted/40 p-0.5">
                          <button
                            type="button"
                            aria-label="Ver detalhes"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-95"
                            onClick={() => handleView(client)}
                            disabled={inactive}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Editar"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-95"
                            onClick={() => handleEdit(client)}
                            disabled={inactive}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Excluir"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                            onClick={() => handleDelete(client)}
                            disabled={inactive}
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
              <div className="hidden lg:block overflow-x-auto p-6 pt-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>DPP</TableHead>
                      <TableHead>IG</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client, index) => {
                      const inactive = isClientInactive(index);
                      return (
                      <TableRow key={client.id} className={cn("table-row-hover", inactive && "opacity-50 pointer-events-none")}>
                        <TableCell className="font-medium">
                          {client.full_name}
                          {inactive && (
                            <Badge variant="destructive" className="ml-2 text-[9px] px-1">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {client.dpp ? format(parseISO(client.dpp), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          {client.dpp && client.status === "gestante" && !client.birth_occurred ? (() => {
                            const w = calculateCurrentPregnancyWeeks(client.pregnancy_weeks, client.pregnancy_weeks_set_at, client.dpp);
                            const d = calculateCurrentPregnancyDays(client.dpp);
                            const post = isPostTerm(client.dpp);
                            if (w === null) return "—";
                            return (
                              <span className={cn("text-xs font-semibold", post ? "text-destructive" : "text-primary")}>
                                {post ? "Pós-Data • " : ""}{w}s {d}d
                              </span>
                            );
                          })() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("badge-status border-0", `badge-${client.status}`)}
                          >
                            {client.status === "outro" && (client as any).custom_status
                              ? (client as any).custom_status
                              : statusLabels[client.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getPlanName(client.plan_setting_id, client.plan)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn("badge-status border-0", `badge-${client.payment_status}`)}
                            >
                              {paymentStatusLabels[client.payment_status as keyof typeof paymentStatusLabels]}
                            </Badge>
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => handleView(client)}
                                disabled={inactive}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => handleEdit(client)}
                                disabled={inactive}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(client)}
                                disabled={inactive}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
                <Users className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-medium text-foreground/70 mb-1">Nenhuma cliente ainda</p>
              <p className="text-sm text-muted-foreground/60 mb-6 text-center max-w-xs">Cadastre sua primeira cliente para começar a acompanhar.</p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Cadastrar cliente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Dialog */}
      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        client={selectedClient}
      />

      {/* Client Details Dialog */}
      <ClientDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        client={selectedClient}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a cliente{" "}
              <strong>{clientToDelete?.full_name}</strong>? Esta ação não pode
              ser desfeita.
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
