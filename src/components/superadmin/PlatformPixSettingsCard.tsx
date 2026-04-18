import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KEYS = ["platform_pix_key", "platform_pix_key_type", "platform_pix_beneficiary", "platform_pix_city"];

export function PlatformPixSettingsCard() {
  const qc = useQueryClient();
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("random");
  const [beneficiary, setBeneficiary] = useState("");
  const [city, setCity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-pix-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", KEYS);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (!data) return;
    setPixKey(data.platform_pix_key || "");
    setPixKeyType(data.platform_pix_key_type || "random");
    setBeneficiary(data.platform_pix_beneficiary || "Doula Care");
    setCity(data.platform_pix_city || "SAO PAULO");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "platform_pix_key", value: pixKey },
        { key: "platform_pix_key_type", value: pixKeyType },
        { key: "platform_pix_beneficiary", value: beneficiary },
        { key: "platform_pix_city", value: city },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from("system_config")
          .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Chave Pix da plataforma salva!");
      qc.invalidateQueries({ queryKey: ["platform-pix-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-pix-config"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Chave Pix da Plataforma</CardTitle>
            <CardDescription>
              Chave usada no QR Code mostrado às doulas que escolherem pagar a assinatura via Pix
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo da chave</Label>
          <Select value={pixKeyType} onValueChange={setPixKeyType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Chave aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Chave Pix</Label>
          <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave Pix" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Beneficiário (até 25 caracteres)</Label>
            <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} maxLength={25} />
          </div>
          <div className="space-y-2">
            <Label>Cidade (até 15 caracteres)</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={15} />
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
