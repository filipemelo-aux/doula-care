import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { formatBrazilTime } from "@/lib/utils";
import { laborQueryKeys, removeContraction } from "@/lib/laborActions";

interface Props {
  contraction: { id: string; started_at: string; ended_at: string | null };
  clientId: string;
  onDeleted?: (id: string) => void;
  discard?: boolean;
}

export function DeleteContractionButton({ contraction, clientId, onDeleted, discard }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removeContraction(contraction.id, clientId);
      onDeleted?.(contraction.id);
      await Promise.all(laborQueryKeys.map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      setOpen(false);
      toast.success("Contração excluída");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a contração.");
    } finally { setBusy(false); }
  };
  return <>
    <Button variant="ghost" size={discard ? "sm" : "icon"} aria-label={discard ? "Descartar contração em andamento" : "Excluir contração"} title={discard ? "Descartar contração em andamento" : "Excluir contração"} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
      <Trash2 className="h-4 w-4" />{discard && <span className="ml-2">Descartar</span>}
    </Button>
    <AlertDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{discard ? "Descartar" : "Excluir"} contração de {formatBrazilTime(contraction.started_at)}?</AlertDialogTitle>
          <AlertDialogDescription>Somente esta contração será removida. O restante do histórico será mantido. Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}