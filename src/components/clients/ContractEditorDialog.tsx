import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileText, Loader2, CheckCircle, Clock, Trash2, Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContractEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function ContractEditorDialog({ open, onOpenChange, clientId, clientName }: ContractEditorDialogProps) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Contrato de Prestação de Serviços");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [viewingSignature, setViewingSignature] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["client-contract", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!clientId,
  });

  useEffect(() => {
    if (contract) {
      setTitle(contract.title);
      setContent(contract.content);
      setEditing(false);
    } else {
      setTitle("Contrato de Prestação de Serviços");
      setContent("");
      setEditing(true);
    }
  }, [contract]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (contract) {
        const { error } = await supabase
          .from("client_contracts")
          .update({ title, content })
          .eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_contracts")
          .insert({
            client_id: clientId,
            organization_id: organizationId,
            title,
            content,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-contract", clientId] });
      setEditing(false);
      toast.success(contract ? "Contrato atualizado!" : "Contrato criado!");
    },
    onError: () => toast.error("Erro ao salvar contrato"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return;
      const { error } = await supabase
        .from("client_contracts")
        .delete()
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-contract", clientId] });
      setTitle("Contrato de Prestação de Serviços");
      setContent("");
      setEditing(true);
      setDeleteConfirmOpen(false);
      toast.success("Contrato removido!");
    },
    onError: () => toast.error("Erro ao remover contrato"),
  });

  const isSigned = contract?.status === "signed";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contrato — {clientName}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-160px)] pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Badge */}
                {contract && (
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={isSigned
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                      }
                    >
                      {isSigned ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Assinado</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" /> Pendente de assinatura</>
                      )}
                    </Badge>
                    {isSigned && contract.signed_at && (
                      <span className="text-xs text-muted-foreground">
                        Assinado em {format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                )}

                {/* Signature Preview */}
                {isSigned && contract?.signature_data && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Assinatura da cliente:</p>
                    {contract.signature_type === "drawn" ? (
                      <div className="bg-background rounded border p-2 flex justify-center">
                        <img src={contract.signature_data} alt="Assinatura" className="max-h-20" />
                      </div>
                    ) : (
                      <p className="font-signature text-2xl text-center italic text-foreground">
                        {contract.signature_data}
                      </p>
                    )}
                    {contract.signer_name && (
                      <p className="text-xs text-muted-foreground text-center">
                        Assinado por: {contract.signer_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Title */}
                <div>
                  <Label className="text-xs">Título do Contrato</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                    disabled={!editing || isSigned}
                  />
                </div>

                {/* Content */}
                <div>
                  <Label className="text-xs">Conteúdo do Contrato</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="mt-1 min-h-[300px] text-sm leading-relaxed"
                    placeholder={`Escreva o contrato aqui...

Exemplo:
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DOULA

CONTRATANTE: ${clientName}
CONTRATADA: [Seu nome]

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de acompanhamento como Doula durante a gestação, parto e pós-parto.

CLÁUSULA SEGUNDA - DOS SERVIÇOS
...`}
                    disabled={!editing || isSigned}
                  />
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex-row gap-2">
            {contract && !isSigned && !editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir
                </Button>
                <Button
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  Editar
                </Button>
              </>
            )}
            {editing && !isSigned && (
              <Button
                size="sm"
                disabled={!content.trim() || !title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {contract ? "Salvar alterações" : "Criar Contrato"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
