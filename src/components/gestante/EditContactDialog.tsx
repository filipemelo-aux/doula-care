import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { maskPhone, maskCEP, maskCPF } from "@/lib/masks";

type Client = Tables<"clients">;

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: () => void;
}

export function EditContactDialog({
  open,
  onOpenChange,
  client,
  onUpdate,
}: EditContactDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    preferred_name: "",
    phone: "",
    cpf: "",
    zip_code: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    companion_name: "",
    companion_phone: "",
    birth_location: "",
    prenatal_type: "",
    prenatal_high_risk: false,
    comorbidades: "",
    alergias: "",
    restricao_aromaterapia: "",
    has_fotografa: false,
    fotografa_name: "",
    fotografa_phone: "",
    instagram_gestante: "",
    instagram_acompanhante: "",
    baby_names: "" as string,
  });

  useEffect(() => {
    if (client) {
      setFormData({
        preferred_name: client.preferred_name || "",
        phone: client.phone || "",
        cpf: client.cpf || "",
        zip_code: client.zip_code || "",
        street: client.street || "",
        number: client.number || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        companion_name: client.companion_name || "",
        companion_phone: client.companion_phone || "",
        birth_location: client.birth_location || "",
        prenatal_type: client.prenatal_type || "",
        prenatal_high_risk: client.prenatal_high_risk || false,
        comorbidades: client.comorbidades || "",
        alergias: client.alergias || "",
        restricao_aromaterapia: client.restricao_aromaterapia || "",
        has_fotografa: client.has_fotografa || false,
        fotografa_name: client.fotografa_name || "",
        fotografa_phone: client.fotografa_phone || "",
        instagram_gestante: client.instagram_gestante || "",
        instagram_acompanhante: client.instagram_acompanhante || "",
        baby_names: (client.baby_names || []).join(", "),
      });
    }
  }, [client]);

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    if (typeof value === "string") {
      if (field === "phone" || field === "companion_phone" || field === "fotografa_phone") {
        value = maskPhone(value);
      } else if (field === "zip_code") {
        value = maskCEP(value);
      } else if (field === "cpf") {
        value = maskCPF(value);
      } else if (field === "state") {
        value = value.toUpperCase();
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setLoading(true);

    try {
      const babyNamesArray = formData.baby_names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("clients")
        .update({
          preferred_name: formData.preferred_name || null,
          phone: formData.phone,
          cpf: formData.cpf || null,
          zip_code: formData.zip_code,
          street: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          companion_name: formData.companion_name,
          companion_phone: formData.companion_phone,
          birth_location: formData.birth_location || null,
          prenatal_type: formData.prenatal_type || null,
          prenatal_high_risk: formData.prenatal_high_risk,
          comorbidades: formData.comorbidades || null,
          alergias: formData.alergias || null,
          restricao_aromaterapia: formData.restricao_aromaterapia || null,
          has_fotografa: formData.has_fotografa,
          fotografa_name: formData.fotografa_name || null,
          fotografa_phone: formData.fotografa_phone || null,
          instagram_gestante: formData.instagram_gestante || null,
          instagram_acompanhante: formData.instagram_acompanhante || null,
          baby_names: babyNamesArray,
        })
        .eq("id", client.id);

      if (error) throw error;

      toast.success("Dados atualizados com sucesso!");
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Meus Dados</DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais, clínicas e de contato
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados Pessoais */}
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados Pessoais</h4>

          <div className="space-y-2">
            <Label htmlFor="preferred_name">Como gostaria de ser chamada</Label>
            <Input
              id="preferred_name"
              value={formData.preferred_name}
              onChange={(e) => handleChange("preferred_name", e.target.value)}
              placeholder="Seu nome ou apelido"
              mask="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => handleChange("cpf", e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram_gestante">Instagram</Label>
            <Input
              id="instagram_gestante"
              value={formData.instagram_gestante}
              onChange={(e) => handleChange("instagram_gestante", e.target.value)}
              placeholder="@seuinstagram"
              className="lowercase"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baby_names">Nomes do(s) bebê(s)</Label>
            <Input
              id="baby_names"
              value={formData.baby_names}
              onChange={(e) => handleChange("baby_names", e.target.value)}
              placeholder="Separe por vírgula"
              mask="name"
            />
          </div>

          {/* Endereço */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Endereço</h4>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleChange("zip_code", e.target.value)}
                    onBlur={(e) => fetchAddressByCep(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => handleChange("number", e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => handleChange("street", e.target.value)}
                  placeholder="Nome da rua"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={formData.neighborhood}
                  onChange={(e) => handleChange("neighborhood", e.target.value)}
                  placeholder="Bairro"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="UF"
                      maxLength={2}
                      mask="uppercase"
                    />
                </div>
              </div>
            </div>
          </div>

          {/* Dados Clínicos */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Dados Clínicos</h4>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="birth_location">Local do Parto</Label>
                <Select
                  value={formData.birth_location}
                  onValueChange={(v) => handleChange("birth_location", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="domiciliar">Domiciliar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prenatal_type">Tipo de Pré-natal</Label>
                <Select
                  value={formData.prenatal_type}
                  onValueChange={(v) => handleChange("prenatal_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sus">SUS</SelectItem>
                    <SelectItem value="plano">Plano de Saúde</SelectItem>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="equipe_particular">Equipe Particular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="prenatal_high_risk">Pré-natal de Alto Risco</Label>
                <Switch
                  id="prenatal_high_risk"
                  checked={formData.prenatal_high_risk}
                  onCheckedChange={(v) => handleChange("prenatal_high_risk", v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comorbidades">Comorbidades</Label>
                <Textarea
                  id="comorbidades"
                  value={formData.comorbidades}
                  onChange={(e) => handleChange("comorbidades", e.target.value)}
                  placeholder="Descreva se houver"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alergias">Alergias</Label>
                <Textarea
                  id="alergias"
                  value={formData.alergias}
                  onChange={(e) => handleChange("alergias", e.target.value)}
                  placeholder="Descreva se houver"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="restricao_aromaterapia">Restrição a Aromaterapia</Label>
                <Textarea
                  id="restricao_aromaterapia"
                  value={formData.restricao_aromaterapia}
                  onChange={(e) => handleChange("restricao_aromaterapia", e.target.value)}
                  placeholder="Descreva se houver"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Acompanhante */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Acompanhante</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="companion_name">Nome do Acompanhante</Label>
                <Input
                  id="companion_name"
                  value={formData.companion_name}
                  onChange={(e) => handleChange("companion_name", e.target.value)}
                  placeholder="Nome completo"
                  mask="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companion_phone">Telefone do Acompanhante</Label>
                <Input
                  id="companion_phone"
                  type="tel"
                  value={formData.companion_phone}
                  onChange={(e) => handleChange("companion_phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_acompanhante">Instagram do Acompanhante</Label>
                <Input
                  id="instagram_acompanhante"
                  value={formData.instagram_acompanhante}
                  onChange={(e) => handleChange("instagram_acompanhante", e.target.value)}
                  placeholder="@instagram"
                />
              </div>
            </div>
          </div>

          {/* Fotógrafa */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Fotógrafa</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="has_fotografa">Possui fotógrafa?</Label>
                <Switch
                  id="has_fotografa"
                  checked={formData.has_fotografa}
                  onCheckedChange={(v) => handleChange("has_fotografa", v)}
                />
              </div>
              {formData.has_fotografa && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fotografa_name">Nome da Fotógrafa</Label>
                    <Input
                      id="fotografa_name"
                      value={formData.fotografa_name}
                      onChange={(e) => handleChange("fotografa_name", e.target.value)}
                      placeholder="Nome"
                      mask="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fotografa_phone">Telefone da Fotógrafa</Label>
                    <Input
                      id="fotografa_phone"
                      type="tel"
                      value={formData.fotografa_phone}
                      onChange={(e) => handleChange("fotografa_phone", e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
