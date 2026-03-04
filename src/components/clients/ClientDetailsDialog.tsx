import { useState } from "react";
import { ContractEditorDialog } from "./ContractEditorDialog";
import { ClientFileDialog } from "./ClientFileDialog";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn, formatBrazilDate } from "@/lib/utils";
import {
  Phone,
  MapPin,
  User,
  CreditCard,
  Calendar,
  FileText,
  KeyRound,
  
  Eye,
  Stethoscope,
  AlertTriangle,
  Camera,
  Instagram,
  Heart,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { parseISO } from "date-fns";

import { RevenueDetailDialog } from "@/components/financial/RevenueDetailDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Client = Tables<"clients">;

interface ClientDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const statusLabels = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Puérpera",
  outro: "Outro",
};

const planLabels: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
  avulso: "Avulso",
};

const paymentStatusLabels = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
};

const paymentMethodLabels = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export function ClientDetailsDialog({
  open,
  onOpenChange,
  client,
}: ClientDetailsDialogProps) {
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [clientFileOpen, setClientFileOpen] = useState(false);
  
  const [revenueDetailOpen, setRevenueDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  // Query client's contract transaction to check installments
  const { data: clientTransaction } = useQuery({
    queryKey: ["client-transaction", client?.id],
    queryFn: async () => {
      if (!client) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, installments, installment_value, amount, amount_received")
        .eq("client_id", client.id)
        .eq("type", "receita")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!client,
  });

  // Query payment records to detect custom/personalized installments
  const { data: clientPayments } = useQuery({
    queryKey: ["client-payments-detail", client?.id, clientTransaction?.id, clientTransaction?.installments],
    queryFn: async () => {
      if (!client?.id) return [];

      if (clientTransaction?.id) {
        const { data: byTx, error: byTxErr } = await supabase
          .from("payments")
          .select("amount, installment_number, total_installments")
          .eq("transaction_id", clientTransaction.id)
          .order("installment_number", { ascending: true });

        if (byTxErr) throw byTxErr;
        if (byTx && byTx.length > 0) return byTx;
      }

      const totalInstallments = Number(clientTransaction?.installments || 1);
      const { data: legacy, error: legacyErr } = await supabase
        .from("payments")
        .select("amount, installment_number, total_installments")
        .eq("client_id", client.id)
        .is("transaction_id", null)
        .eq("total_installments", totalInstallments)
        .order("installment_number", { ascending: true });

      if (legacyErr) throw legacyErr;
      return legacy || [];
    },
    enabled: open && !!client?.id && (Number(clientTransaction?.installments || 1) > 1),
  });

  // Detect if payments have custom (non-equal) amounts
  const hasCustomInstallments = (() => {
    if (!clientPayments || clientPayments.length <= 1) return false;
    const firstAmt = Number(clientPayments[0].amount);
    return clientPayments.some(p => Math.abs(Number(p.amount) - firstAmt) > 0.01);
  })();

  if (!client) return null;

  

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const address = [
    client.street,
    client.number,
    client.neighborhood,
    client.city,
    client.state,
    client.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Detalhes da Cliente
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-100px)] pr-4">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {client.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("badge-status border-0 shrink-0 pl-0", `badge-${client.status}`)}
                  >
                    {statusLabels[client.status as keyof typeof statusLabels]}
                  </Badge>
                  {client.status === "gestante" && client.pregnancy_weeks && (
                    <span className="text-xs text-muted-foreground">
                      {client.pregnancy_weeks} sem
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-foreground mt-1 break-words">
                  {client.full_name}
                </h2>
                {client.status === "gestante" && client.dpp && (
                  <span className="text-sm text-muted-foreground">
                    DPP: {formatBrazilDate(client.dpp)}
                  </span>
                )}
                {client.status === "gestante" && (client as any).birth_location && (
                  <span className="text-sm text-muted-foreground">
                    🏥 {(client as any).birth_location}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <Separator />
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 justify-start"
                onClick={() => setClientFileOpen(true)}
              >
                <Eye className="w-4 h-4" />
                Ficha da Cliente
              </Button>
              {client.user_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start"
                  onClick={() => setContractDialogOpen(true)}
                >
                  <FileText className="w-4 h-4" />
                  Contrato
                </Button>
              )}
            </div>

            {!client.user_id && client.status === "gestante" && client.dpp && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Esta cliente ainda não tem acesso ao app. Edite e salve para criar o acesso automaticamente.
              </div>
            )}

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contato
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
                {client.cpf && (
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{client.cpf}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            {address && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço
                  </h3>
                  <p className="text-sm">{address}</p>
                </div>
              </>
            )}

            {/* Companion */}
            {(client.companion_name || client.companion_phone) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Acompanhante
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {client.companion_name && (
                      <div>
                        <p className="text-muted-foreground">Nome</p>
                        <p className="font-medium">{client.companion_name}</p>
                      </div>
                    )}
                    {client.companion_phone && (
                      <div>
                        <p className="text-muted-foreground">Telefone</p>
                        <p className="font-medium">{client.companion_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Plan Info */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Plano e Pagamento
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Plano</p>
                  <p className="font-medium">
                    {planLabels[client.plan as keyof typeof planLabels]}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-medium">
                    {formatCurrency(Number(client.plan_value) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-medium">
                    {paymentMethodLabels[client.payment_method as keyof typeof paymentMethodLabels]}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "badge-status border-0",
                      `badge-${client.payment_status}`
                    )}
                  >
                    {paymentStatusLabels[client.payment_status as keyof typeof paymentStatusLabels]}
                  </Badge>
                </div>
                {clientTransaction && (clientTransaction.installments || 1) > 1 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Pagamento</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-medium">
                        {hasCustomInstallments
                          ? `${clientTransaction.installments}x — Parcelas personalizadas`
                          : `Parcelado em ${clientTransaction.installments}x de ${formatCurrency(Number(clientTransaction.installment_value) || 0)}`
                        }
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setRevenueDetailOpen(true)}
                      >
                        <Eye className="h-3 w-3" />
                        Detalhes
                      </Button>
                    </div>
                  </div>
                )}
                {clientTransaction && (clientTransaction.installments || 1) <= 1 && (
                  <div className="col-span-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => setRevenueDetailOpen(true)}
                    >
                      <Eye className="h-3 w-3" />
                      Ver Detalhes Financeiros
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Prenatal Info */}
            {((client as any).prenatal_type || (client as any).prenatal_high_risk) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Pré-natal
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {(client as any).prenatal_type && (
                      <div>
                        <p className="text-muted-foreground">Tipo</p>
                        <p className="font-medium">
                          {{ sus: "SUS", plano: "Plano de Saúde", particular: "Particular", equipe_particular: "Equipe Particular" }[(client as any).prenatal_type as string] || (client as any).prenatal_type}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Alto Risco</p>
                      <div className="flex items-center gap-1">
                        {(client as any).prenatal_high_risk ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <span className="font-medium">Não</span>
                        )}
                      </div>
                    </div>
                    {(client as any).prenatal_type === "equipe_particular" && Array.isArray((client as any).prenatal_team) && (client as any).prenatal_team.length > 0 && (
                      <div className="col-span-2 space-y-2">
                        <p className="text-muted-foreground">Equipe</p>
                        <div className="space-y-1">
                          {((client as any).prenatal_team as {name: string; role: string}[]).map((member, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{member.name}</span>
                              {member.role && (
                                <span className="text-muted-foreground">— {member.role}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Saúde e Restrições */}
            {((client as any).comorbidades || (client as any).alergias || (client as any).restricao_aromaterapia) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Saúde e Restrições
                  </h3>
                  <div className="space-y-2 text-sm">
                    {(client as any).comorbidades && (
                      <div>
                        <p className="text-muted-foreground text-xs">Comorbidades</p>
                        <p className="font-medium whitespace-pre-wrap">{(client as any).comorbidades}</p>
                      </div>
                    )}
                    {(client as any).alergias && (
                      <div>
                        <p className="text-muted-foreground text-xs">Alergias</p>
                        <p className="font-medium whitespace-pre-wrap">{(client as any).alergias}</p>
                      </div>
                    )}
                    {(client as any).restricao_aromaterapia && (
                      <div>
                        <p className="text-muted-foreground text-xs">Restrições em Aromaterapia</p>
                        <p className="font-medium whitespace-pre-wrap">{(client as any).restricao_aromaterapia}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Fotógrafa */}
            {(client as any).has_fotografa && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Fotógrafa
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {(client as any).fotografa_name && (
                      <div>
                        <p className="text-muted-foreground">Nome</p>
                        <p className="font-medium">{(client as any).fotografa_name}</p>
                      </div>
                    )}
                    {(client as any).fotografa_phone && (
                      <div>
                        <p className="text-muted-foreground">Telefone</p>
                        <p className="font-medium">{(client as any).fotografa_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Redes Sociais */}
            {((client as any).instagram_gestante || (client as any).instagram_acompanhante) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Redes Sociais
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {(client as any).instagram_gestante && (
                      <div>
                        <p className="text-muted-foreground">Gestante</p>
                        <p className="font-medium">{(client as any).instagram_gestante}</p>
                      </div>
                    )}
                    {(client as any).instagram_acompanhante && (
                      <div>
                        <p className="text-muted-foreground">Acompanhante</p>
                        <p className="font-medium">{(client as any).instagram_acompanhante}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {client.notes && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </div>
              </>
            )}

            {/* Metadata */}
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Cadastrada em {formatBrazilDate(client.created_at, "dd 'de' MMMM 'de' yyyy")}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>


      {client && (
        <ContractEditorDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          clientId={client.id}
          clientName={client.full_name}
          client={client}
        />
      )}
    </Dialog>

      {clientTransaction && (
        <RevenueDetailDialog
          open={revenueDetailOpen}
          onOpenChange={setRevenueDetailOpen}
          transactionId={clientTransaction.id}
        />
      )}

      

      <ClientFileDialog
        open={clientFileOpen}
        onOpenChange={setClientFileOpen}
        client={client}
      />
    </>
  );
}
