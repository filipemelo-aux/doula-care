import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { maskPhone, maskCEP } from "@/lib/masks";

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
    zip_code: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    companion_name: "",
    companion_phone: "",
  });

  useEffect(() => {
    if (client) {
      setFormData({
        preferred_name: client.preferred_name || "",
        phone: client.phone || "",
        zip_code: client.zip_code || "",
        street: client.street || "",
        number: client.number || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        companion_name: client.companion_name || "",
        companion_phone: client.companion_phone || "",
      });
    }
  }, [client]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === "phone" || field === "companion_phone") {
      value = maskPhone(value);
    } else if (field === "zip_code") {
      value = maskCEP(value);
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
      const { error } = await supabase
        .from("clients")
        .update({
          preferred_name: formData.preferred_name || null,
          phone: formData.phone,
          zip_code: formData.zip_code,
          street: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          companion_name: formData.companion_name,
          companion_phone: formData.companion_phone,
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
          <DialogTitle>Editar Dados de Contato</DialogTitle>
          <DialogDescription>
            Atualize seu telefone, endereço e dados do acompanhante
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preferred_name">Como gostaria de ser chamada</Label>
            <Input
              id="preferred_name"
              value={formData.preferred_name}
              onChange={(e) => handleChange("preferred_name", e.target.value)}
              placeholder="Seu nome ou apelido"
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
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Acompanhante</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="companion_name">Nome do Acompanhante</Label>
                <Input
                  id="companion_name"
                  value={formData.companion_name}
                  onChange={(e) => handleChange("companion_name", e.target.value)}
                  placeholder="Nome completo"
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
