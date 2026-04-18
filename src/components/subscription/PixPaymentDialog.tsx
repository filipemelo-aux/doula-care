import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, AlertTriangle, ShieldCheck, Clock, ArrowRight } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Header com destaque do valor */}
        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-6 pt-6 pb-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-primary-foreground text-lg font-semibold">
              Pagamento via Pix
            </DialogTitle>
            <p className="text-xs text-primary-foreground/80">
              Plano <span className="capitalize font-medium">{planName}</span> · {billingType === "yearly" ? "Anual" : "Mensal"}
            </p>
          </DialogHeader>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">{valorFmt}</span>
          </div>
        </div>

        {loadingConfig ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !pixKey ? (
          <div className="py-8 px-6 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="font-medium text-foreground">Pix indisponível</p>
            <p className="text-sm text-muted-foreground">
              A chave Pix da plataforma ainda não foi configurada. Tente outro método ou contate o suporte.
            </p>
          </div>
        ) : submitted ? (
          <div className="py-8 px-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-foreground">Pagamento declarado!</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Recebemos sua declaração. Assim que confirmarmos o pagamento, seu plano será ativado e você receberá uma notificação.
            </p>
            <Button className="w-full mt-2" onClick={() => onOpenChange(false)}>
              Entendi
            </Button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Passos */}
            <ol className="space-y-2.5">
              <li className="flex gap-3 items-start text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                <span className="text-foreground">Copie o código Pix abaixo</span>
              </li>
              <li className="flex gap-3 items-start text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                <span className="text-foreground">Abra o app do seu banco e escolha <strong>Pix Copia e Cola</strong></span>
              </li>
              <li className="flex gap-3 items-start text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">3</span>
                <span className="text-foreground">Cole o código, confirme o pagamento e clique em <strong>Já paguei</strong></span>
              </li>
            </ol>

            {/* Código Pix */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Código Pix Copia e Cola
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {beneficiary}
                </span>
              </div>
              <div className="bg-muted/60 rounded-xl p-3 max-h-28 overflow-y-auto border border-border/50">
                <code className="block text-[11px] font-mono text-foreground break-all leading-relaxed">
                  {payload}
                </code>
              </div>
              <Button
                variant={copied ? "outline" : "default"}
                onClick={handleCopy}
                className="w-full h-10"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Código copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar código Pix
                  </>
                )}
              </Button>
            </div>

            {/* Aviso */}
            <div className="flex gap-2 items-start bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-lg px-3 py-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                A ativação do plano ocorre após a confirmação manual do pagamento pela equipe — geralmente em poucos minutos.
              </p>
            </div>

            {/* Já paguei */}
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleAlreadyPaid}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Já paguei
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
