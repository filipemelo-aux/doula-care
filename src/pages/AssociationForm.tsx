import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { maskPhone, toTitleCase } from "@/lib/masks";

const schema = z.object({
  association_name: z.string().trim().min(2, "Informe o nome da associação").max(200),
  name: z.string().trim().min(3, "Informe seu nome completo").max(200),
  email: z.string().trim().toLowerCase().email("Informe o e-mail usado no Doula Care").max(200),
  phone: z.string().trim().max(30).optional(),
});

export default function AssociationForm() {
  const [association, setAssociation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse({ association_name: association, name, email, phone });
    if (!p.success) {
      toast.error(p.error.issues[0]?.message || "Confira os dados");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("association_submissions").insert({
      association_name: p.data.association_name,
      president_name: p.data.name,
      president_phone: p.data.phone || null,
      doulas: [{ name: p.data.name, contact: p.data.email }],
    } as any);
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-secondary/40">
      <div className="max-w-xl mx-auto p-4 py-10 space-y-4">
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <div className="h-2 bg-primary" />
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Heart className="w-5 h-5" />
              <span className="text-sm font-semibold">Doula Care · Parceria</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">Benefício exclusivo da associação</h1>
            <p className="text-sm text-muted-foreground">
              Você que faz parte da associação e já usa o Doula Care: preencha seus dados para receber o
              desconto de 12 meses na assinatura.
            </p>
          </CardContent>
        </Card>

        {done ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-display font-bold">Tudo certo! 💛</h2>
              <p className="text-sm text-muted-foreground">
                Recebemos seus dados. Vamos aplicar o desconto na sua conta do Doula Care.
              </p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Seu nome completo *</Label>
                  <Input value={name} onChange={(e) => setName(toTitleCase(e.target.value))} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail cadastrado no Doula Care *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} maxLength={15} inputMode="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome da associação *</Label>
                  <Input value={association} onChange={(e) => setAssociation(toTitleCase(e.target.value))} maxLength={200} />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-12" disabled={sending}>
              {sending ? "Enviando..." : "Quero meu desconto"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
