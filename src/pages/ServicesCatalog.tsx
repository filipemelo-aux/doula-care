import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function ServicesCatalog() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["custom-services-all", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_services")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["custom-services-all"] });
    qc.invalidateQueries({ queryKey: ["custom-services"] });
    qc.invalidateQueries({ queryKey: ["custom-services-list"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const serviceName = name.trim();
      if (!serviceName) throw new Error("Informe o nome do serviço");
      let icon = "🔧";
      try {
        const { data } = await supabase.functions.invoke("generate-service-icon", { body: { serviceName } });
        if (data?.icon) icon = data.icon;
      } catch { /* ícone padrão */ }
      const { error } = await supabase
        .from("custom_services")
        .insert({ name: serviceName, organization_id: organizationId!, icon });
      if (error) throw error.code === "23505" ? new Error("Esse serviço já existe") : error;
    },
    onSuccess: () => { setName(""); invalidate(); toast.success("Serviço cadastrado"); },
    onError: (e: any) => toast.error(e.message || "Erro ao cadastrar"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("custom_services").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Serviço removido"); },
    onError: () => toast.error("Erro ao remover serviço"),
  });

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="page-header mb-0">
        <h1 className="page-title">Cadastro de Serviços</h1>
        <p className="page-description">Serviços disponíveis ao registrar um novo atendimento.</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      >
        <Input placeholder="Nome do serviço (ex.: Massagem)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={add.isPending} className="gap-2 shrink-0">
          {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
        </Button>
      </form>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : services.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <span className="text-xl w-8 text-center">{s.icon}</span>
                <span className="flex-1 font-medium truncate">{s.name}</span>
                <Switch
                  checked={s.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: s.id, is_active: v })}
                  aria-label="Ativo"
                />
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)} aria-label="Remover">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
