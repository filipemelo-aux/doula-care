import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/lib/pixPayload";
import { Copy, Check, Loader2, ShieldCheck, CalendarClock } from "lucide-react";
import { toast } from "sonner";

interface PixSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  billingType: "monthly" | "yearly";
  amountCents: number;
  /** Valor cheio antes do cupom, quando houver desconto */
  originalAmountCents?: number;
  couponCode?: string | null;
}

function formatCentavos(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PixSubscriptionDialog({
  open,
  onOpenChange,
  planId,
  planName,
  billingType,
  amountCents,
  originalAmountCents,
  couponCode,
}: PixSubscriptionDialogProps) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-pix-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", [
          "platform_pix_key",
          "platform_pix_key_type",
          "platform_pix_beneficiary",
          "platform_pix_city",
        ]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => (map[r.key] = r.value));
      return map;
    },
    enabled: open,
  });

  const pixKey = config?.platform_pix_key ?? "";
  const beneficiary = config?.platform_pix_beneficiary ?? "DOULA CARE";
  const city = config?.platform_pix_city ?? "ARAGUAINA";

  const payload = pixKey
    ? generatePixPayload({
        pixKey,
        beneficiaryName: beneficiary,
        city,
        amount: amountCents / 100,
      })
    : "";

  const hasDiscount =
    !!originalAmountCents && originalAmountCents > amountCents;

  const periodLabel = billingType === "yearly" ? "12 meses" : "30 dias";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success("Código Pix copiado");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDeclare = async () => {
    if (!user?.id) return;
    setDeclaring(true);
    try {
      const { error } = await supabase.from("plan_pix_payments").insert({
        user_id: user.id,
        organization_id: organizationId ?? null,
        plan_id: planId,
        billing_type: billingType,
        amount: amountCents,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-pix-payments"] });
      setDeclared(true);
      toast.success("Pagamento informado! Vamos confirmar em instantes.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível registrar o pagamento");
    } finally {
      setDeclaring(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setDeclared(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
          {/* Resumo do pedido */}
          <div className="bg-muted/40 p-6 space-y-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl">Finalizar pagamento</DialogTitle>
              <DialogDescription>
                Pague por Pix e libere o acesso ao plano {planName}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-background p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Plano {planName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {billingType === "yearly" ? "Anual" : "Mensal"} · acesso por{" "}
                    {periodLabel}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Pix
                </Badge>
              </div>

              <Separator />

              {hasDiscount && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-muted-foreground line-through">
                      {formatCentavos(originalAmountCents!)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Cupom {couponCode}
                    </span>
                    <span className="text-primary font-medium">
                      −{formatCentavos(originalAmountCents! - amountCents)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatCentavos(amountCents)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <CalendarClock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Pagamento único, sem renovação automática. Ao final dos{" "}
                {periodLabel} você paga um novo Pix ou escolhe o cartão com
                renovação automática.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Recebedor: {beneficiary}.
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="p-6">
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !pixKey ? (
              <p className="text-sm text-muted-foreground">
                Chave Pix não configurada. Entre em contato com o suporte.
              </p>
            ) : declared ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-foreground">
                  Pagamento informado
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Assim que o Pix for confirmado, seu plano é liberado e você
                  recebe um aviso aqui no sistema.
                </p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  Escaneie o QR Code
                </p>
                <div className="flex justify-center rounded-2xl bg-white p-4 border border-border">
                  <QRCodeSVG value={payload} size={188} />
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Pix copia e cola
                  </p>
                  <p className="text-[11px] break-all font-mono leading-snug max-h-20 overflow-y-auto">
                    {payload}
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copied ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  Copiar código
                </Button>
                <Button className="w-full" onClick={handleDeclare} disabled={declaring}>
                  {declaring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Já efetuei o pagamento
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
