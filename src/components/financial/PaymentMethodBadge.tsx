import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { QrCode, CreditCard, Banknote, Building2, FileText, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto";

const methodConfig: Record<PaymentMethod, { icon: typeof QrCode; label: string; color: string; bg: string }> = {
  pix: { icon: QrCode, label: "Pix", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
  cartao: { icon: CreditCard, label: "Cartão", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-800" },
  dinheiro: { icon: Banknote, label: "Dinheiro", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800" },
  transferencia: { icon: Building2, label: "Transf.", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" },
  boleto: { icon: FileText, label: "Boleto", color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800" },
};

interface PaymentMethodBadgeProps {
  currentMethod: PaymentMethod | string | null | undefined;
  onChangeMethod: (method: PaymentMethod) => void;
  compact?: boolean;
}

export function PaymentMethodBadge({ currentMethod, onChangeMethod, compact }: PaymentMethodBadgeProps) {
  const [open, setOpen] = useState(false);

  const method = currentMethod as PaymentMethod | undefined;
  const config = method ? methodConfig[method] : null;
  const Icon = config?.icon || HelpCircle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:opacity-80",
            config ? `${config.bg} ${config.color}` : "bg-muted border-border text-muted-foreground"
          )}
        >
          <Icon className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
          <span>{config?.label || "Não definido"}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5" align="start" sideOffset={4}>
        <div className="space-y-0.5">
          {(Object.entries(methodConfig) as [PaymentMethod, typeof methodConfig["pix"]][]).map(([key, cfg]) => {
            const MethodIcon = cfg.icon;
            const isActive = key === method;
            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2 h-8 text-xs font-medium",
                  isActive && "bg-primary/10 text-primary"
                )}
                onClick={() => {
                  onChangeMethod(key);
                  setOpen(false);
                }}
              >
                <MethodIcon className="h-3.5 w-3.5" />
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
