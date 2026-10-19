import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Baby, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { laborQueryKeys, startClientLabor, acknowledgeContractions } from "@/lib/laborActions";

export function StartLaborButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const client = await startClientLabor(clientId);
      toast.success(`Início do trabalho de parto registrado para ${client.full_name}`);
      await acknowledgeContractions(clientId).catch(() => toast.error("O início foi salvo, mas não foi possível marcar as contrações como lidas."));
      await Promise.all(laborQueryKeys.map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o trabalho de parto.");
    } finally { setBusy(false); }
  };
  return <Button size="sm" variant="outline" disabled={busy} className="h-auto min-h-9 px-2.5 py-2 text-[11px] whitespace-normal text-primary" onClick={event => { event.stopPropagation(); void start(); }}>
    {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin shrink-0" /> : <Baby className="h-3.5 w-3.5 mr-1 shrink-0" />}
    {busy ? "Salvando..." : "Iniciar Trabalho de Parto"}
  </Button>;
}