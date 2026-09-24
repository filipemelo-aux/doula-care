import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientDialog } from "./ClientDialog";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Atalho "Nova Cliente": cadastra a pessoa e, em seguida,
 * abre o Novo acompanhamento já com ela selecionada.
 */
export function NewClientFlow({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [followClient, setFollowClient] = useState<Tables<"clients"> | null>(null);

  const handleSaved = async (id: string) => {
    const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    if (data) setFollowClient(data);
  };

  return (
    <>
      <ClientDialog open={open} onOpenChange={onOpenChange} mode="person" onSaved={handleSaved} />
      <ClientDialog
        key={followClient?.id || "none"}
        open={!!followClient}
        onOpenChange={(o) => !o && setFollowClient(null)}
        client={followClient}
        mode="followup"
      />
    </>
  );
}
