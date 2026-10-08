import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserRound, HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientDialog } from "./ClientDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type Category = "avulsa" | "acompanhamento" | null;

/**
 * Atalho "Nova Cliente": pergunta a categoria.
 * - Avulsa: cadastro de pessoa só com Pessoal e Endereço.
 * - Acompanhamento: Pessoal, Endereço e Saúde, depois segue para o acompanhamento.
 */
export function NewClientFlow({
  open,
  onOpenChange,
  canAddFollowUp = true,
  initialCategory = null,
}: {
  /** Pula a pergunta de tipo e abre direto nessa categoria. */
  initialCategory?: Category;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Falso quando o limite de gestantes do plano foi atingido. */
  canAddFollowUp?: boolean;
}) {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>(null);
  const [followClient, setFollowClient] = useState<Tables<"clients"> | null>(null);

  useEffect(() => {
    if (open) setCategory(initialCategory);
  }, [open, initialCategory]);

  const handleSaved = async (id: string) => {
    const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    if (data) setFollowClient(data);
  };

  const closeAll = () => {
    setCategory(null);
    onOpenChange(false);
  };

  const options = [
    { key: "avulsa" as const, icon: UserRound, title: "Cliente ocasional", desc: "Para atendimentos ocasionais. Pede apenas dados pessoais e endereço." },
    { key: "acompanhamento" as const, icon: HeartHandshake, title: "Cliente de acompanhamento", desc: "Cadastro completo com saúde e, em seguida, o plano do acompanhamento." },
  ];

  return (
    <>
      <Dialog open={open && !category} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="max-w-md w-[92vw]">
          <DialogHeader>
            <DialogTitle className="font-display">Nova cliente</DialogTitle>
            <DialogDescription>Qual o tipo de cliente?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  if (o.key === "acompanhamento" && !canAddFollowUp) {
                    toast.error("Limite de gestantes atingido", {
                      description: "Faça upgrade do plano para cadastrar mais gestantes. Clientes ocasionais e atendimentos continuam liberados.",
                    });
                    return;
                  }
                  setCategory(o.key);
                }}
                className="w-full flex items-start gap-3 rounded-2xl bg-muted/40 hover:bg-primary/10 p-4 text-left transition-colors active:scale-[0.99]"
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <o.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{o.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  {o.key === "acompanhamento" && !canAddFollowUp && (
                    <p className="text-xs font-medium text-destructive mt-1">Limite de gestantes do plano atingido</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ClientDialog
        key={category || "none"}
        open={open && !!category}
        onOpenChange={(o) => !o && closeAll()}
        mode={category === "avulsa" ? "person-basic" : "person"}
        onSaved={category === "acompanhamento" ? handleSaved : undefined}
      />
      <ClientDialog
        key={followClient?.id || "follow-none"}
        open={!!followClient}
        onOpenChange={(o) => !o && setFollowClient(null)}
        client={followClient}
        mode="followup"
        onSaved={(id) => navigate(`/cadastros/usuarios?cliente=${id}&auto=1`)}
      />
    </>
  );
}
