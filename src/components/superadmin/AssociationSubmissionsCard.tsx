import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Copy } from "lucide-react";
import { toast } from "sonner";

const FORM_URL = "https://doulacare.app.br/associacao";

export function AssociationSubmissionsCard() {
  const { data = [] } = useQuery({
    queryKey: ["association-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("association_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="rounded-2xl border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Doulas de associações parceiras
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{FORM_URL}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => {
              navigator.clipboard.writeText(FORM_URL);
              toast.success("Link copiado");
            }}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma lista recebida ainda.</p>}
        {data.map((s: any) => (
          <div key={s.id} className="rounded-xl bg-muted/50 p-3 space-y-1">
            <p className="font-semibold text-sm">{s.association_name}</p>
            <p className="text-xs text-muted-foreground">
              Presidente: {s.president_name}
              {s.president_phone ? ` · ${s.president_phone}` : ""} ·{" "}
              {new Date(s.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
            <ol className="list-decimal pl-5 text-sm">
              {(s.doulas || []).map((d: any, i: number) => (
                <li key={i}>
                  {d.name}
                  {d.contact ? <span className="text-muted-foreground"> — {d.contact}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
