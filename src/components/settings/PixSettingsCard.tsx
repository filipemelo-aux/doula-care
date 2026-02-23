import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PixSettingsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("random");
  const [beneficiaryName, setBeneficiaryName] = useState("");

  const { isLoading } = useQuery({
    queryKey: ["admin-pix-settings"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setPixKey(data.pix_key || "");
        setPixKeyType(data.pix_key_type || "random");
        setBeneficiaryName(data.pix_beneficiary_name || "");
      }
      return data;
    },
    enabled: !!user,
  });

  const { organizationId } = useAuth();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("admin_settings")
        .upsert({
          owner_id: user.id,
          organization_id: organizationId,
          pix_key: pixKey || null,
          pix_key_type: pixKeyType,
          pix_beneficiary_name: beneficiaryName || null,
        }, { onConflict: "owner_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações de Pix salvas!");
      queryClient.invalidateQueries({ queryKey: ["admin-pix-settings"] });
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  if (isLoading) {
    return (
      <Card className="card-glass">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
            <CardTitle className="text-lg">Chave Pix</CardTitle>
            <CardDescription>
              Configure sua chave Pix para que as clientes possam efetuar pagamentos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo da chave</Label>
          <Select value={pixKeyType} onValueChange={setPixKeyType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
          <Input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Digite sua chave Pix"
          />
        </div>

        <div className="space-y-2">
          <Label>Nome do beneficiário</Label>
          <Input
            value={beneficiaryName}
            onChange={(e) => setBeneficiaryName(e.target.value)}
            placeholder="Nome que aparecerá para a cliente"
          />
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
