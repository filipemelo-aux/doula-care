import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, PenTool, Type, Loader2, CheckCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

export function ContractSignDialog({ open, onOpenChange, contractId }: ContractSignDialogProps) {
  const { client } = useGestanteAuth();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [signMethod, setSignMethod] = useState<"draw" | "type">("draw");
  const [agreed, setAgreed] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["gestante-contract", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!contractId,
  });

  // Setup canvas
  useEffect(() => {
    if (!open || signMethod !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [open, signMethod]);

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const signMutation = useMutation({
    mutationFn: async () => {
      let signatureData = "";
      let sigType: "drawn" | "typed" = "typed";

      if (signMethod === "draw") {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas não encontrado");
        signatureData = canvas.toDataURL("image/png");
        sigType = "drawn";
      } else {
        signatureData = typedName.trim();
        sigType = "typed";
      }

      const { error } = await supabase
        .from("client_contracts")
        .update({
          status: "signed",
          signature_data: signatureData,
          signature_type: sigType,
          signed_at: new Date().toISOString(),
          signer_name: client?.full_name || typedName,
        })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestante-contract"] });
      queryClient.invalidateQueries({ queryKey: ["gestante-pending-contract"] });
      queryClient.invalidateQueries({ queryKey: ["client-contract"] });
      toast.success("Contrato assinado com sucesso!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao assinar contrato"),
  });

  const isSigned = contract?.status === "signed";
  const canSign = signMethod === "draw" ? hasDrawn && agreed : typedName.trim().length >= 3 && agreed;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {contract?.title || "Contrato"}
          </DialogTitle>
          {isSigned && (
            <Badge className="w-fit border-green-300 bg-green-50 text-green-700" variant="outline">
              <CheckCircle className="h-3 w-3 mr-1" />
              Assinado em {contract?.signed_at && format(new Date(contract.signed_at), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(95vh-200px)] px-6">
          {/* Contract Content */}
          <div className="rounded-lg border bg-muted/20 p-4 mb-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{contract?.content}</p>
          </div>

          {/* Already signed view */}
          {isSigned && contract?.signature_data && (
            <div className="rounded-lg border bg-green-50/50 p-4 space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground">Sua assinatura:</p>
              {contract.signature_type === "drawn" ? (
                <div className="bg-background rounded border p-2 flex justify-center">
                  <img src={contract.signature_data} alt="Assinatura" className="max-h-24" />
                </div>
              ) : (
                <p className="font-serif text-3xl text-center italic text-foreground py-2">
                  {contract.signature_data}
                </p>
              )}
            </div>
          )}

          {/* Signing area */}
          {!isSigned && (
            <div className="space-y-4 mb-4">
              <Tabs value={signMethod} onValueChange={(v) => setSignMethod(v as "draw" | "type")}>
                <TabsList className="w-full">
                  <TabsTrigger value="draw" className="flex-1 gap-1.5">
                    <PenTool className="h-3.5 w-3.5" />
                    Desenhar
                  </TabsTrigger>
                  <TabsTrigger value="type" className="flex-1 gap-1.5">
                    <Type className="h-3.5 w-3.5" />
                    Digitar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw" className="space-y-2 mt-3">
                  <Label className="text-xs">Desenhe sua assinatura abaixo:</Label>
                  <div className="relative rounded-lg border-2 border-dashed border-primary/30 bg-background">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-32 touch-none cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-sm text-muted-foreground/50">Assine aqui</p>
                      </div>
                    )}
                  </div>
                  {hasDrawn && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={clearCanvas}>
                      <RotateCcw className="h-3 w-3" />
                      Limpar
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="type" className="space-y-2 mt-3">
                  <Label className="text-xs">Digite seu nome completo:</Label>
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="text-lg"
                  />
                  {typedName.trim().length >= 3 && (
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
                      <p className="font-serif text-3xl text-center italic">{typedName}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Declaro que li e concordo com todos os termos deste contrato. Minha assinatura digital tem validade jurídica conforme a legislação vigente.
                </span>
              </label>
            </div>
          )}
        </ScrollArea>

        {!isSigned && (
          <DialogFooter className="px-6 pb-6">
            <Button
              className="w-full"
              disabled={!canSign || signMutation.isPending}
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <CheckCircle className="h-4 w-4 mr-1" />
              Assinar Contrato
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
