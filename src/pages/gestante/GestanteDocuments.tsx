import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { GestanteLayout } from "@/components/gestante/GestanteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, lazy, Suspense } from "react";
import { ContractSignDialog } from "@/components/gestante/ContractSignDialog";
import { toast } from "sonner";

export default function GestanteDocuments() {
  const { client } = useGestanteAuth();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["gestante-contracts", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id,
  });

  const generatePdf = async (contract: any) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 25;

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(contract.title || "Contrato", maxWidth);
      pdf.text(titleLines, pageWidth / 2, y, { align: "center" });
      y += titleLines.length * 8 + 10;

      // Status badge
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const statusText = contract.status === "signed"
        ? `✓ Assinado em ${format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
        : "⏳ Pendente de assinatura";
      pdf.text(statusText, pageWidth / 2, y, { align: "center" });
      y += 12;

      // Divider
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Content
      if (contract.file_url) {
        pdf.setFontSize(11);
        pdf.text("Este contrato foi anexado como arquivo.", margin, y);
        y += 8;
        pdf.setTextColor(0, 100, 200);
        pdf.textWithLink("Clique aqui para acessar o arquivo original", margin, y, { url: contract.file_url });
        pdf.setTextColor(0);
        y += 12;
      } else if (contract.content) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(contract.content, maxWidth);
        for (const line of lines) {
          if (y > 270) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(line, margin, y);
          y += 5.5;
        }
        y += 10;
      }

      // Signature section
      if (contract.status === "signed") {
        if (y > 230) {
          pdf.addPage();
          y = 20;
        }

        pdf.setDrawColor(200);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 10;

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Assinatura", margin, y);
        y += 8;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");

        if (contract.signer_name) {
          pdf.text(`Assinado por: ${contract.signer_name}`, margin, y);
          y += 6;
        }
        pdf.text(`Data: ${format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
        y += 10;

        if (contract.signature_type === "drawn" && contract.signature_data) {
          try {
            const imgWidth = 60;
            const imgHeight = 25;
            pdf.addImage(contract.signature_data, "PNG", margin, y, imgWidth, imgHeight);
            y += imgHeight + 5;
          } catch {
            // skip if image fails
          }
        } else if (contract.signature_type === "typed" && contract.signature_data) {
          pdf.setFontSize(20);
          pdf.setFont("times", "italic");
          pdf.text(contract.signature_data, margin, y + 5);
          y += 15;
        }

        // Signature line
        pdf.setDrawColor(150);
        pdf.line(margin, y, margin + 80, y);
        y += 5;
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(contract.signer_name || "Contratante", margin, y);
      }

      // Footer
      const footerY = pdf.internal.pageSize.getHeight() - 10;
      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(
        `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2, footerY, { align: "center" }
      );

      pdf.save(`${(contract.title || "contrato").replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <GestanteLayout>
      <div className="p-3 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Documentos</h1>
          <p className="page-description">Seus contratos e documentos</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !contracts?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum documento disponível</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const isSigned = contract.status === "signed";
              return (
                <Card key={contract.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSigned
                          ? "bg-gradient-to-br from-green-100 to-emerald-200"
                          : "bg-gradient-to-br from-amber-100 to-orange-200"
                      }`}>
                        <FileText className={`h-5 w-5 ${isSigned ? "text-green-700" : "text-amber-700"}`} />
                      </div>

                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-sm break-words line-clamp-2">{contract.title}</p>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${
                              isSigned
                                ? "border-green-300 bg-green-100 text-green-800"
                                : "border-amber-300 bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isSigned ? (
                              <><CheckCircle className="h-3 w-3 mr-0.5" /> Assinado</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-0.5" /> Pendente</>
                            )}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mb-3 break-words">
                          {isSigned && contract.signed_at
                            ? `Assinado em ${format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : `Enviado em ${format(new Date(contract.created_at), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isSigned ? "outline" : "default"}
                            className="h-7 text-xs gap-1.5"
                            onClick={() => {
                              setSelectedContractId(contract.id);
                              setSignDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            {isSigned ? "Visualizar" : "Ler e Assinar"}
                          </Button>

                          {isSigned && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => generatePdf(contract)}
                            >
                              <Download className="h-3 w-3" />
                              Baixar PDF
                            </Button>
                          )}

                          {contract.file_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              asChild
                            >
                              <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3" />
                                Arquivo Original
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {selectedContractId && (
        <ContractSignDialog
          open={signDialogOpen}
          onOpenChange={setSignDialogOpen}
          contractId={selectedContractId}
        />
      )}
    </GestanteLayout>
  );
}
