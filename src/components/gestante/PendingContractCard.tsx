import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PenTool } from "lucide-react";
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

  if (!contract || contract.status !== "pending") return null;

  const isPending = true;

  return (
    <>
      <Card className="overflow-hidden border border-amber-300 bg-gradient-to-br from-amber-50/80 to-orange-50/50 animate-pulse-subtle">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-100 to-orange-200">
              <FileText className="h-5 w-5 text-amber-700" />
            </div>

            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex flex-col gap-1 mb-1">
                <p className="font-semibold text-sm break-words whitespace-normal">{contract.title}</p>
                <Badge
                  variant="outline"
                  className="w-fit shrink-0 text-[10px] border-amber-300 bg-amber-100 text-amber-800"
                >
                  Pendente
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Sua doula enviou um contrato para você assinar.
              </p>

              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setSelectedContractId(contract.id);
                  setSignDialogOpen(true);
                }}
              >
                <PenTool className="h-3 w-3" />
                Ler e Assinar
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
