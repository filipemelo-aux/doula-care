import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PenTool, CheckCircle } from "lucide-react";
import { ContractSignDialog } from "./ContractSignDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PendingContractCard() {
  const { client } = useGestanteAuth();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const { data: contract } = useQuery({
    queryKey: ["gestante-pending-contract", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id,
  });

  if (!contract) return null;

  const isPending = contract.status === "pending";
  const isSigned = contract.status === "signed";

  return (
    <>
      <Card className={`overflow-hidden border ${
        isPending
          ? "border-amber-300 bg-gradient-to-br from-amber-50/80 to-orange-50/50 animate-pulse-subtle"
          : "border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30"
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPending
                ? "bg-gradient-to-br from-amber-100 to-orange-200"
                : "bg-gradient-to-br from-green-100 to-emerald-200"
            }`}>
              <FileText className={`h-5 w-5 ${isPending ? "text-amber-700" : "text-green-700"}`} />
            </div>

            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-start gap-2 mb-1 flex-wrap">
                <p className="font-semibold text-sm break-words line-clamp-2">{contract.title}</p>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${
                    isPending
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-green-300 bg-green-100 text-green-800"
                  }`}
                >
                  {isPending ? "Pendente" : "Assinado"}
                </Badge>
              </div>

              {isPending ? (
                <p className="text-xs text-muted-foreground mb-3">
                  Sua doula enviou um contrato para você assinar.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-2">
                  Assinado em {contract.signed_at && format(new Date(contract.signed_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}

              <Button
                size="sm"
                variant={isPending ? "default" : "outline"}
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setSelectedContractId(contract.id);
                  setSignDialogOpen(true);
                }}
              >
                {isPending ? (
                  <>
                    <PenTool className="h-3 w-3" />
                    Ler e Assinar
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Ver Contrato
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedContractId && (
        <ContractSignDialog
          open={signDialogOpen}
          onOpenChange={setSignDialogOpen}
          contractId={selectedContractId}
        />
      )}
    </>
  );
}
