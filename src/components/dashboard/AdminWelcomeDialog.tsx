import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, ArrowRight } from "lucide-react";

interface AdminWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  name: string | null;
}

const STEPS = [
  {
    title: "Sua identidade",
    text: (
      <>
        Em <strong>Meu Negócio → Minha Marca</strong>, escolha cores e logo; em{" "}
        <strong>Localização e Atendimento</strong>, defina onde você atende.
      </>
    ),
  },
  {
    title: "Seus serviços",
    text: (
      <>
        Em <strong>Cadastros → Serviços</strong>, registre o que você oferece e os valores.
      </>
    ),
  },
  {
    title: "Suas clientes",
    text: (
      <>
        Em <strong>Serviços → Acompanhamentos</strong>, cadastre a gestante; em{" "}
        <strong>Serviços → Atendimentos</strong>, registre um atendimento avulso.
      </>
    ),
  },
  {
    title: "Rotina e recebimentos",
    text: (
      <>
        Na <strong>Agenda</strong>, organize horários e solicitações; em{" "}
        <strong>Financeiro → Contas a Receber</strong>, acompanhe os pagamentos.
      </>
    ),
  },
];

export function AdminWelcomeDialog({ open, onClose, name }: AdminWelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display">
            Bem-vinda ao Doula Care, {name || "Doula"}! 💛
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-left">
          <p className="text-muted-foreground text-center">
            Que alegria ter você aqui! Seu espaço de cuidado está pronto. 🌸
          </p>
          <div className="rounded-[16px] bg-primary/10 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-foreground leading-snug">
              <Gift className="h-4 w-4 text-primary inline-block mr-1.5 -mt-0.5" />
              Você ganhou <span className="whitespace-nowrap">15 dias de Premium</span>, com todos
              os recursos liberados, inclusive equipe!
            </p>
          </div>
          <div className="bg-muted/50 rounded-[16px] p-4 space-y-3">
            <p className="font-medium text-center">Vamos começar?</p>
            <ol className="space-y-2.5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-snug">
                    <span className="font-medium text-foreground">{step.title}: </span>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-muted-foreground text-center text-sm">
            E, quando quiser trocar experiências, encontre outras doulas na{" "}
            <strong className="text-foreground">Comunidade</strong>. Vá no seu ritmo! ✨
          </p>
          <Button onClick={onClose} className="w-full">
            Vamos começar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
