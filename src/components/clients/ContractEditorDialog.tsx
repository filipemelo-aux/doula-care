import { useState, useEffect, useMemo, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Loader2,
  CheckCircle,
  Clock,
  Trash2,
  Wand2,
  Upload,
  Eye,
  Edit,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskCPF } from "@/lib/masks";
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
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface ContractEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  client?: Client | null;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão de Crédito/Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência Bancária",
};

export function ContractEditorDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  client,
}: ContractEditorDialogProps) {
  const { organizationId, profileName } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Contrato de Prestação de Serviços de Doula");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "attach">("auto");
  const [previewing, setPreviewing] = useState(false);

  // Auto-generate form fields
  const [doulaName, setDoulaName] = useState("");
  const [doulaCpf, setDoulaCpf] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [additionalClauses, setAdditionalClauses] = useState("");

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch existing contract
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

  // Fetch plan settings for this client's plan
  const { data: planSetting } = useQuery({
    queryKey: ["client-plan-setting", client?.plan_setting_id],
    queryFn: async () => {
      if (!client?.plan_setting_id) return null;
      const { data, error } = await supabase
        .from("plan_settings")
        .select("*")
        .eq("id", client.plan_setting_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!client?.plan_setting_id,
  });

  // Fetch organization info
  const { data: org } = useQuery({
    queryKey: ["org-info", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, nome_exibicao")
        .eq("id", organizationId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!organizationId,
  });

  // Set doula name from profile
  useEffect(() => {
    if (profileName && !doulaName) {
      setDoulaName(profileName);
    }
  }, [profileName]);

  // Reset form when dialog opens/closes or contract loads
  useEffect(() => {
    if (contract) {
      setTitle(contract.title);
      setContent(contract.content);
      setEditing(false);
      setPreviewing(false);
    } else if (open) {
      setTitle("Contrato de Prestação de Serviços de Doula");
      setContent("");
      setEditing(true);
      setPreviewing(false);
      setAdditionalClauses("");
      setDoulaCpf("");
      setSelectedFile(null);
      setServiceDescription("");
    }
  }, [contract, open]);

  // Build service description from plan features (runs after planSetting loads)
  useEffect(() => {
    if (!open || contract) return;
    // If client has no plan linked, nothing to auto-fill
    if (!client?.plan_setting_id) return;
    // Wait for planSetting to actually load (not undefined/loading)
    if (planSetting === undefined) return;
    if (planSetting?.features && planSetting.features.length > 0) {
      setServiceDescription(planSetting.features.join(";\n") + ".");
    } else if (planSetting?.description) {
      setServiceDescription(planSetting.description);
    } else if (planSetting?.name) {
      setServiceDescription(`Serviços conforme o plano "${planSetting.name}".`);
    }
  }, [planSetting, open, contract, client?.plan_setting_id]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const todayFormatted = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const clientAddress = useMemo(() => {
    if (!client) return "Endereço não informado";
    const parts = [client.street, client.number, client.neighborhood, client.city, client.state, client.zip_code].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Endereço não informado";
  }, [client]);

  const generateContract = () => {
    const planName = planSetting?.name || "Não especificado";
    const planValue = client?.plan_value ? formatCurrency(Number(client.plan_value)) : "A definir";
    const paymentMethod = client?.payment_method ? paymentMethodLabels[client.payment_method] || client.payment_method : "A definir";
    const clientCpf = client?.cpf || "Não informado";
    const orgName = org?.nome_exibicao || org?.name || doulaName;

    const generatedContent = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DOULA

CONTRATANTE: ${clientName}
CPF: ${clientCpf}
Endereço: ${clientAddress}
${client?.phone ? `Telefone: ${client.phone}` : ""}

CONTRATADA: ${doulaName}
${doulaCpf ? `CPF: ${doulaCpf}` : ""}
${orgName !== doulaName ? `Empresa: ${orgName}` : ""}

CLÁUSULA PRIMEIRA — DO OBJETO
O presente contrato tem por objeto a prestação de serviços de acompanhamento como Doula, conforme o plano "${planName}", abrangendo os seguintes serviços:

${serviceDescription || "Serviços conforme plano contratado."}

CLÁUSULA SEGUNDA — DO VALOR E PAGAMENTO
O valor total dos serviços é de ${planValue}, a ser pago via ${paymentMethod}.

Parágrafo único: O não pagamento nas datas acordadas poderá acarretar a suspensão dos serviços até a regularização.

CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES DA CONTRATADA
a) Prestar os serviços descritos na Cláusula Primeira com dedicação, ética e respeito;
b) Manter sigilo sobre todas as informações pessoais e clínicas da contratante;
c) Estar disponível nos horários previamente acordados;
d) Fornecer orientações baseadas em evidências científicas atualizadas.

CLÁUSULA QUARTA — DAS OBRIGAÇÕES DA CONTRATANTE
a) Fornecer informações verdadeiras sobre seu estado de saúde;
b) Efetuar os pagamentos nas datas acordadas;
c) Comunicar com antecedência eventuais cancelamentos ou remarcações;
d) Seguir as orientações fornecidas pela doula dentro de suas possibilidades.

CLÁUSULA QUINTA — DO CANCELAMENTO E RESCISÃO
a) A contratante poderá cancelar o contrato a qualquer momento, sendo devidos os valores proporcionais aos serviços já prestados;
b) A contratada poderá rescindir o contrato em caso de inadimplência superior a 30 (trinta) dias ou impossibilidade de continuidade;
c) Em caso de cancelamento por parte da contratante, não haverá reembolso dos valores já pagos referentes a serviços prestados.

CLÁUSULA SEXTA — DA RESPONSABILIDADE
A doula não realiza procedimentos médicos, diagnósticos ou prescrições. Seu papel é de suporte emocional, físico e informativo. Decisões médicas são de responsabilidade da equipe de saúde e da contratante.

CLÁUSULA SÉTIMA — DA CONFIDENCIALIDADE
Todas as informações compartilhadas durante o acompanhamento são confidenciais e não serão divulgadas a terceiros sem autorização expressa da contratante, exceto em casos previstos por lei.
${additionalClauses ? `\n${additionalClauses}\n` : ""}
CLÁUSULA OITAVA — DO FORO
Fica eleito o foro da comarca de ${client?.city || "[cidade]"}, ${client?.state || "[estado]"}, para dirimir quaisquer dúvidas oriundas deste contrato.

E por estarem de acordo, as partes assinam o presente contrato digitalmente.

${client?.city || "[Cidade]"}, ${todayFormatted}.`;

    setContent(generatedContent);
    setPreviewing(true);
  };

  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Nenhum arquivo selecionado");
      setUploading(true);

      const ext = selectedFile.name.split(".").pop();
      const filePath = `${clientId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, selectedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("contracts")
        .getPublicUrl(filePath);

      const { error } = await supabase.from("client_contracts").insert({
        client_id: clientId,
        organization_id: organizationId,
        title,
        content: "Contrato anexado em arquivo.",
        file_url: urlData.publicUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-contract", clientId] });
      setEditing(false);
      setSelectedFile(null);
      toast.success("Contrato anexado com sucesso!");
    },
    onError: () => toast.error("Erro ao anexar contrato"),
    onSettled: () => setUploading(false),
  });

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
      setPreviewing(false);
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
      setTitle("Contrato de Prestação de Serviços de Doula");
      setContent("");
      setEditing(true);
      setPreviewing(false);
      setDeleteConfirmOpen(false);
      toast.success("Contrato removido!");
    },
    onError: () => toast.error("Erro ao remover contrato"),
  });

  const isSigned = contract?.status === "signed";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-y-auto">
          <DialogHeader className="px-4 sm:px-6 pt-6 pb-2">
            <DialogTitle className="font-display flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate">Contrato — {clientName}</span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-160px)] px-4 sm:px-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {/* Status Badge */}
                {contract && (
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={
                        isSigned
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
                        Assinado em{" "}
                        {format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>
                )}

                {/* Signature Preview */}
                {isSigned && contract?.signature_data && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Assinatura da cliente:
                    </p>
                    {contract.signature_type === "drawn" ? (
                      <div className="bg-background rounded border p-2 flex justify-center">
                        <img src={contract.signature_data} alt="Assinatura" className="max-h-20" />
                      </div>
                    ) : (
                      <p className="font-serif text-2xl text-center italic text-foreground">
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

                {/* Mode selector - only for new contracts */}
                {!contract && editing && !previewing && (
                  <Tabs
                    value={mode}
                    onValueChange={(v) => setMode(v as "auto" | "attach")}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="auto" className="flex-1 gap-1.5">
                        <Wand2 className="h-3.5 w-3.5" />
                        Gerar automático
                      </TabsTrigger>
                      <TabsTrigger value="attach" className="flex-1 gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        Anexar contrato
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="auto" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Preencha os campos abaixo. Os dados da cliente e do plano já estão
                        preenchidos automaticamente.
                      </p>

                      <div>
                        <Label className="text-xs">Nome da Doula / Contratada</Label>
                        <Input
                          value={doulaName}
                          onChange={(e) => setDoulaName(e.target.value)}
                          className="mt-1"
                          placeholder="Seu nome completo"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">CPF da Doula (opcional)</Label>
                        <Input
                          value={doulaCpf}
                          onChange={(e) => setDoulaCpf(maskCPF(e.target.value))}
                          className="mt-1 lowercase"
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Serviços inclusos no contrato</Label>
                        <Textarea
                          value={serviceDescription}
                          onChange={(e) => setServiceDescription(e.target.value)}
                          className="mt-1 min-h-[100px] text-sm"
                          placeholder="Descreva os serviços inclusos..."
                        />
                        {planSetting && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {planSetting.features && planSetting.features.length > 0
                              ? `Preenchido com os serviços do plano "${planSetting.name}"`
                              : `Plano "${planSetting.name}" sem serviços cadastrados — adicione os serviços manualmente ou cadastre-os nas configurações do plano`}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs">Cláusulas adicionais (opcional)</Label>
                        <Textarea
                          value={additionalClauses}
                          onChange={(e) => setAdditionalClauses(e.target.value)}
                          className="mt-1 min-h-[80px] text-sm"
                          placeholder="Adicione cláusulas extras se necessário..."
                        />
                      </div>

                      {/* Summary of auto-filled data */}
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-xs">
                        <p className="font-medium text-muted-foreground mb-2">
                          Dados preenchidos automaticamente:
                        </p>
                        <p>
                          <span className="text-muted-foreground">Cliente:</span>{" "}
                          {clientName}
                        </p>
                        {client?.cpf && (
                          <p>
                            <span className="text-muted-foreground">CPF:</span> {client.cpf}
                          </p>
                        )}
                        <p>
                          <span className="text-muted-foreground">Endereço:</span>{" "}
                          {clientAddress}
                        </p>
                        {planSetting && (
                          <p>
                            <span className="text-muted-foreground">Plano:</span>{" "}
                            {planSetting.name}
                          </p>
                        )}
                        {client?.plan_value && (
                          <p>
                            <span className="text-muted-foreground">Valor:</span>{" "}
                            {formatCurrency(Number(client.plan_value))}
                          </p>
                        )}
                        {client?.payment_method && (
                          <p>
                            <span className="text-muted-foreground">Pagamento:</span>{" "}
                            {paymentMethodLabels[client.payment_method] ||
                              client.payment_method}
                          </p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="attach" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Anexe um contrato existente em PDF ou imagem. A cliente poderá
                        visualizá-lo e assiná-lo digitalmente.
                      </p>
                      <div>
                        <Label className="text-xs">Título do Contrato</Label>
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error("Arquivo muito grande. Máximo 10MB.");
                              return;
                            }
                            setSelectedFile(file);
                          }
                        }}
                      />
                      {!selectedFile ? (
                        <div
                          className="rounded-lg border-2 border-dashed border-primary/30 bg-muted/20 p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium text-muted-foreground">
                            Clique para selecionar um arquivo
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, JPG, PNG ou WEBP (máx. 10MB)
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedFile.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}

                {/* Preview of generated contract */}
                {!contract && editing && previewing && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Prévia do contrato gerado
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 h-7"
                        onClick={() => setPreviewing(false)}
                      >
                        <Edit className="h-3 w-3" />
                        Voltar e editar
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Conteúdo (você pode editar antes de salvar)</Label>
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="mt-1 min-h-[350px] text-sm leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* Existing contract view (read/edit) */}
                {contract && (
                  <div className="space-y-3">
                    {/* File attachment indicator */}
                    {(contract as any).file_url && (
                      <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Contrato anexado</p>
                          <p className="text-xs text-muted-foreground">
                            Arquivo enviado pela doula
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1"
                          asChild
                        >
                          <a
                            href={(contract as any).file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Abrir
                          </a>
                        </Button>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Título do Contrato</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1"
                        disabled={!editing || isSigned}
                      />
                    </div>
                    {!(contract as any).file_url && (
                      <div>
                        <Label className="text-xs">Conteúdo do Contrato</Label>
                        <Textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="mt-1 min-h-[300px] text-sm leading-relaxed"
                          disabled={!editing || isSigned}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex-row gap-2 px-4 sm:px-6 pb-6">
            {/* Existing contract actions */}
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
                <Button size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              </>
            )}
            {contract && editing && !isSigned && (
              <Button
                size="sm"
                disabled={!content.trim() || !title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Salvar alterações
              </Button>
            )}

            {/* New contract actions */}
            {!contract && editing && !previewing && mode === "auto" && (
              <Button
                size="sm"
                className="w-full"
                disabled={!doulaName.trim()}
                onClick={generateContract}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Gerar Contrato
              </Button>
            )}
            {!contract && editing && !previewing && mode === "attach" && (
              <Button
                size="sm"
                className="w-full"
                disabled={!selectedFile || !title.trim() || uploading}
                onClick={() => uploadFileMutation.mutate()}
              >
                {uploading && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                <Upload className="h-4 w-4 mr-1" />
                Anexar Contrato
              </Button>
            )}
            {!contract && editing && previewing && (
              <Button
                size="sm"
                className="w-full"
                disabled={!content.trim() || !title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                <CheckCircle className="h-4 w-4 mr-1" />
                Salvar Contrato
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
