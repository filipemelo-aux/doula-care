import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  Phone,
  MapPin,
  User,
  CreditCard,
  Calendar,
  FileText,
  Bell,
  KeyRound,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SendNotificationDialog } from "./SendNotificationDialog";

type Client = Tables<"clients">;

interface ClientDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const statusLabels = {
  tentante: "Tentante",
  gestante: "Gestante",
  lactante: "Lactante",
};

const planLabels = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
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
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Detalhes da Cliente
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {client.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {client.full_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn("badge-status border-0", `badge-${client.status}`)}
                  >
                    {statusLabels[client.status as keyof typeof statusLabels]}
                  </Badge>
                  {client.status === "gestante" && client.pregnancy_weeks && (
                    <span className="text-sm text-muted-foreground">
                      {client.pregnancy_weeks} semanas
                    </span>
                  )}
                  {client.status === "gestante" && client.dpp && (
                    <span className="text-sm text-muted-foreground">
                      DPP: {format(parseISO(client.dpp), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {client.user_id && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNotificationDialogOpen(true)}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Enviar Notificação
                  </Button>
                </div>
              </>
            )}

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
              </div>
            </div>

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
              Cadastrada em{" "}
              {format(new Date(client.created_at), "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      <SendNotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
        client={client}
      />
    </Dialog>
  );
}
