import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientDialog } from "@/components/clients/ClientDialog";
import type { Tables } from "@/integrations/supabase/types";

export default function People() {
  const { organizationId } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"clients"> | null>(null);
  const [search, setSearch] = useState("");

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["clients", "people", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("is_visitor", false)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const list = people.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="page-header mb-0 min-w-0">
          <h1 className="page-title">Cadastro de Pessoas</h1>
          <p className="page-description">Dados pessoais, endereço e saúde das suas clientes.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2 w-full md:w-auto">
          <Plus className="w-4 h-4" /> Nova pessoa
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.phone, p.city && `${p.city}${p.state ? `/${p.state}` : ""}`].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClientDialog
        key={editing?.id || "new"}
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        client={editing}
        mode="person"
      />
    </div>
  );
}
