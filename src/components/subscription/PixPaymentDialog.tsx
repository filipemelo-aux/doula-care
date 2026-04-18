import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { generatePixPayload } from "@/lib/pixPayload";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  planId: string | null;
  planName: string;
  amount: number; // em centavos
  billingType: "monthly" | "yearly";
}

export function PixPaymentDialog({ open, onOpenChange, planId, planName, amount, billingType }: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Carrega configuração Pix da plataforma
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["platform-pix-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .like("key", "platform_pix_%");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
    enabled: open,
  });

  const pixKey = config?.platform_pix_key?.trim() || "";
  const beneficiary = config?.platform_pix_beneficiary?.trim() || "Doula Care";
  const city = config?.platform_pix_city?.trim() || "SAO PAULO";

  const valorReais = (amount / 100);
  const valorFmt = valorReais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const payload = pixKey
    ? generatePixPayload({
        pixKey,
        beneficiaryName: beneficiary,
        city,
        amount: valorReais,
        txId: `PLAN${(planId || "").substring(0, 8).toUpperCase()}`,
      })
    : "";

  useEffect(() => {
    if (!payload) { setQrUrl(null); return; }
    QRCode.toDataURL(payload, { width: 280, margin: 1 })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [payload]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setSubmitted(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAlreadyPaid = async () => {
    if (!planId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("declare-pix-payment", {
        body: { plan_id: planId, billing_type: billingType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
      toast.success("Pagamento declarado! Aguardando confirmação.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao declarar pagamento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar com Pix</DialogTitle>
          <DialogDescription>
            Plano <span className="font-semibold capitalize">{planName}</span> — {valorFmt}
            {billingType === "yearly" ? " (anual)" : " (mensal)"}
          </DialogDescription>
        </DialogHeader>

        {loadingConfig ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !pixKey ? (
          <div className="py-6 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="font-medium text-foreground">Pagamento via Pix indisponível</p>
            <p className="text-sm text-muted-foreground">
              A chave Pix da plataforma ainda não foi configurada. Tente outro método ou contate o suporte.
            </p>
          </div>
        ) : submitted ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-foreground">Pagamento declarado!</p>
            <p className="text-sm text-muted-foreground">
              Recebemos sua declaração. Assim que o pagamento for confirmado pela equipe, seu plano será ativado automaticamente.
              Você receberá uma notificação.
            </p>
            <Button className="w-full mt-2" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-2xl p-4 flex flex-col items-center">
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code Pix" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Aponte a câmera do banco para o QR Code
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Ou copie o código Pix:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 text-[11px] bg-muted/50 rounded-lg px-3 py-2 truncate font-mono">
                  {payload}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Beneficiário: <span className="font-medium">{beneficiary}</span>
              </p>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Após realizar o pagamento, clique abaixo. Sua assinatura será ativada
                em até alguns minutos após a confirmação pela equipe.
              </p>
              <Button
                className="w-full"
                onClick={handleAlreadyPaid}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Já paguei
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
