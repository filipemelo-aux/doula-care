import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  association_name: z.string().trim().min(2, "Informe o nome da associação").max(200),
  president_name: z.string().trim().min(2, "Informe o nome da presidente").max(200),
  president_phone: z.string().trim().max(30).optional(),
  doulas: z
    .array(z.object({ name: z.string().trim().min(3).max(200), contact: z.string().trim().max(200) }))
    .min(1, "Adicione pelo menos uma doula")
    .max(300),
});

type Doula = { name: string; contact: string };

export default function AssociationForm() {
  const [association, setAssociation] = useState("");
  const [president, setPresident] = useState("");
  const [phone, setPhone] = useState("");
  const [doulas, setDoulas] = useState<Doula[]>([{ name: "", contact: "" }]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const update = (i: number, field: keyof Doula, v: string) =>
    setDoulas((d) => d.map((x, idx) => (idx === i ? { ...x, [field]: v } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = doulas.filter((d) => d.name.trim());
    const parsed = schema.safeParse({
      association_name: association,
      president_name: president,
      president_phone: phone,
      doulas: filled,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Confira os nomes (mínimo 3 letras)");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("association_submissions").insert(parsed.data as any);
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
            <h1 className="text-2xl font-display font-bold text-foreground">Doulas da associação</h1>
            <p className="text-sm text-muted-foreground">
              Informe o nome completo das doulas da associação que já usam o Doula Care. Elas receberão o
              desconto da parceria na assinatura.
            </p>
          </CardContent>
        </Card>

        {done ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-display font-bold">Lista enviada com sucesso! 💛</h2>
              <p className="text-sm text-muted-foreground">
                Obrigada! Vamos aplicar o desconto para cada doula informada.
              </p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome da associação *</Label>
                  <Input value={association} onChange={(e) => setAssociation(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>Seu nome completo (presidente) *</Label>
                  <Input value={president} onChange={(e) => setPresident(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <p className="font-semibold text-foreground">Doulas que estão aderindo *</p>
                {doulas.map((d, i) => (
                  <div key={i} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Doula {i + 1}</span>
                      {doulas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDoulas((x) => x.filter((_, idx) => idx !== i))}
                          className="text-destructive"
                          aria-label="Remover doula"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Nome completo"
                      value={d.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                      maxLength={200}
                    />
                    <Input
                      placeholder="E-mail ou WhatsApp usado no app (opcional)"
                      value={d.contact}
                      onChange={(e) => update(i, "contact", e.target.value)}
                      maxLength={200}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDoulas((x) => [...x, { name: "", contact: "" }])}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar outra doula
                </Button>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-12" disabled={sending}>
              {sending ? "Enviando..." : "Enviar lista"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
