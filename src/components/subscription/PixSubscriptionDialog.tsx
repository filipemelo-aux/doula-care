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
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/lib/pixPayload";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PixSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  billingType: "monthly" | "yearly";
  amountCents: number;
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
}: PixSubscriptionDialogProps) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [declaring, setDeclaring] = useState(false);

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
      toast.success("Pagamento informado! Vamos confirmar em breve.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível registrar o pagamento");
    } finally {
      setDeclaring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar com Pix</DialogTitle>
          <DialogDescription>
            {planName} — {billingType === "yearly" ? "anual" : "mensal"} ·{" "}
            {formatCentavos(amountCents)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !pixKey ? (
          <p className="text-sm text-muted-foreground">
            Chave Pix não configurada. Entre em contato com o suporte.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <QRCodeSVG value={payload} size={188} />
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Pix copia e cola</p>
              <p className="text-[11px] break-all font-mono leading-snug">{payload}</p>
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
            <p className="text-[11px] text-muted-foreground text-center">
              Após a confirmação, seu plano é liberado automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
