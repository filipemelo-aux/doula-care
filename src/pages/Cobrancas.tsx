import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  Loader2,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatBrazilDate } from "@/lib/utils";
import { sendPushNotification } from "@/lib/pushNotifications";

type InstallmentRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  client_user_id: string | null;
  installment_number: number;
  total_installments: number;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: string;
  daysFromToday: number; // negative = overdue, 0 = today, positive = upcoming
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Cobrancas() {
  const { user, organizationId, role } = useAuth();
  const isModerator = role === "moderator";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "vencidas" | "vencendo">("todos");
  const [dialogRow, setDialogRow] = useState<InstallmentRow | null>(null);
  const [customMessage, setCustomMessage] = useState("");

  const { data: rows, isLoading } = useQuery<InstallmentRow[]>({
    queryKey: ["cobrancas-installments", organizationId, isModerator ? user?.id : "all"],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select(
          "id, client_id, installment_number, total_installments, amount, amount_paid, due_date, status, clients(full_name, phone, user_id, payment_status)"
        )
        .eq("organization_id", organizationId!)
        .neq("status", "pago")
        .not("due_date", "is", null);
      if (isModerator && user?.id) q = q.eq("owner_id", user.id);
      const { data, error } = await q.order("due_date", { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + 30);

      return (data || [])
        .filter((p: any) => {
          if (!p.clients) return false;
          if (p.clients.payment_status === "pago") return false;
          if (Number(p.amount_paid || 0) >= Number(p.amount || 0)) return false;
          const due = parseISO(p.due_date);
          // overdue OR within the next 30 days
          return due <= horizon;
        })
        .map((p: any) => {
          const due = parseISO(p.due_date);
          return {
            id: p.id,
            client_id: p.client_id,
            client_name: p.clients?.full_name || "—",
            client_phone: p.clients?.phone ?? null,
            client_user_id: p.clients?.user_id ?? null,
            installment_number: p.installment_number,
            total_installments: p.total_installments,
            amount: Number(p.amount || 0),
            amount_paid: Number(p.amount_paid || 0),
            due_date: p.due_date,
            status: p.status,
            daysFromToday: differenceInCalendarDays(due, today),
          } as InstallmentRow;
        });
    },
  });

  const filtered = useMemo(() => {
    let list = rows || [];
    if (tab === "vencidas") list = list.filter((r) => r.daysFromToday < 0);
    if (tab === "vencendo") list = list.filter((r) => r.daysFromToday >= 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.client_name.toLowerCase().includes(q));
    }
    return list;
  }, [rows, tab, search]);

  const totals = useMemo(() => {
    const overdue = (rows || []).filter((r) => r.daysFromToday < 0);
    const upcoming = (rows || []).filter((r) => r.daysFromToday >= 0);
    const sum = (arr: InstallmentRow[]) =>
      arr.reduce((acc, r) => acc + (r.amount - r.amount_paid), 0);
    return {
      overdueCount: overdue.length,
      overdueAmount: sum(overdue),
      upcomingCount: upcoming.length,
      upcomingAmount: sum(upcoming),
    };
  }, [rows]);

  const sendMutation = useMutation({
    mutationFn: async ({
      row,
      message,
    }: {
      row: InstallmentRow;
      message: string;
    }) => {
      const isOverdue = row.daysFromToday < 0;
      const title = isOverdue
        ? "🚨 Pagamento em atraso"
        : row.daysFromToday === 0
        ? "💰 Pagamento vence hoje"
        : "💰 Lembrete de pagamento";

      const body =
        message.trim() ||
        (isOverdue
          ? `Sua parcela ${row.installment_number}/${row.total_installments} de ${formatCurrency(
              row.amount
            )} estava prevista para ${formatBrazilDate(row.due_date)} e ainda não foi registrada.`
          : row.daysFromToday === 0
          ? `Sua parcela ${row.installment_number}/${row.total_installments} de ${formatCurrency(
              row.amount
            )} vence hoje.`
          : `Sua parcela ${row.installment_number}/${row.total_installments} de ${formatCurrency(
              row.amount
            )} vence em ${row.daysFromToday} dia${row.daysFromToday === 1 ? "" : "s"} (${formatBrazilDate(row.due_date)}).`);

      // Insert in-app notification for the client
      const { error: insertError } = await supabase
        .from("client_notifications")
        .insert({
          client_id: row.client_id,
          organization_id: organizationId,
          title,
          message: body,
        });
      if (insertError) throw insertError;

      // Push notification
      await sendPushNotification({
        client_ids: [row.client_id],
        title,
        message: body,
        url: "/gestante/mensagens",
        tag: "manual-billing-reminder",
        type: "payment_received",
      });
    },
    onSuccess: () => {
      toast.success("Cobrança enviada para a cliente.");
      setDialogRow(null);
      setCustomMessage("");
      queryClient.invalidateQueries({ queryKey: ["cobrancas-installments"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao enviar cobrança");
    },
  });

  const renderBadge = (row: InstallmentRow) => {
    if (row.daysFromToday < 0) {
      return (
        <Badge variant="destructive" className="text-[10px]">
          {Math.abs(row.daysFromToday)} dia{Math.abs(row.daysFromToday) === 1 ? "" : "s"} em atraso
        </Badge>
      );
    }
    if (row.daysFromToday === 0) {
      return (
        <Badge className="bg-amber-500 text-white text-[10px] hover:bg-amber-500">
          Vence hoje
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px]">
        Vence em {row.daysFromToday} dia{row.daysFromToday === 1 ? "" : "s"}
      </Badge>
    );
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="page-title">Cobranças</h1>
        <p className="page-description">
          Gerencie as parcelas vencidas ou a vencer e envie lembretes manuais para as clientes que você
          escolher.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm bg-destructive/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Em atraso</span>
            </div>
            <p className="text-2xl font-display text-destructive">
              {totals.overdueCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(totals.overdueAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm bg-amber-500/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-amber-600">
              <CalendarClock className="w-4 h-4" />
              <span className="text-xs font-medium">A vencer (30d)</span>
            </div>
            <p className="text-2xl font-display text-amber-600">
              {totals.upcomingCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(totals.upcomingAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da cliente..."
            className="pl-9"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="todos" className="flex-1">Todos</TabsTrigger>
            <TabsTrigger value="vencidas" className="flex-1">Vencidas</TabsTrigger>
            <TabsTrigger value="vencendo" className="flex-1">A vencer</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma parcela {tab === "vencidas" ? "vencida" : tab === "vencendo" ? "a vencer" : "pendente"} encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const pending = row.amount - row.amount_paid;
            return (
              <Card
                key={row.id}
                className="rounded-2xl border-0 shadow-sm transition-transform active:scale-[0.99]"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {formatBrazilDate(row.due_date)}
                      </p>
                      <p className="font-medium text-foreground truncate mt-0.5">
                        {row.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Parcela {row.installment_number}/{row.total_installments} •{" "}
                        {formatCurrency(pending)}
                      </p>
                    </div>
                    {renderBadge(row)}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        setDialogRow(row);
                        setCustomMessage("");
                      }}
                    >
                      <Bell className="w-4 h-4" />
                      Enviar cobrança
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Send dialog */}
      <Dialog
        open={!!dialogRow}
        onOpenChange={(o) => {
          if (!o) {
            setDialogRow(null);
            setCustomMessage("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar cobrança</DialogTitle>
            <DialogDescription>
              {dialogRow && (
                <>
                  Para <strong>{dialogRow.client_name}</strong> • Parcela{" "}
                  {dialogRow.installment_number}/{dialogRow.total_installments} de{" "}
                  {formatCurrency(dialogRow.amount - dialogRow.amount_paid)} —{" "}
                  vencimento {formatBrazilDate(dialogRow.due_date)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-message">Mensagem (opcional)</Label>
              <Textarea
                id="custom-message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Deixe em branco para usar a mensagem padrão de lembrete."
                rows={4}
              />
              <p className="text-[11px] text-muted-foreground">
                Se você não preencher, será enviada uma mensagem automática com os dados da parcela.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogRow(null)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={sendMutation.isPending}
                onClick={() =>
                  dialogRow &&
                  sendMutation.mutate({ row: dialogRow, message: customMessage })
                }
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
