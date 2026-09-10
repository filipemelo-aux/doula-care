import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { KeyRound, Save, Apple, Smartphone } from "lucide-react";

const KEYS = [
  {
    key: "revenuecat_ios_key",
    label: "App Store (iOS)",
    icon: <Apple className="h-4 w-4" />,
    placeholder: "appl_xxxxxxxxxxxxxxxxxxxx",
  },
  {
    key: "revenuecat_android_key",
    label: "Google Play (Android)",
    icon: <Smartphone className="h-4 w-4" />,
    placeholder: "goog_xxxxxxxxxxxxxxxxxxxx",
  },
];

export function StoreKeysCard() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sa-store-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("key, value")
        .in(
          "key",
          KEYS.map((k) => k.key)
        );
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("system_config")
        .upsert({ key, value } as any, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-store-keys"] });
      toast.success("Chave salva!");
    },
    onError: () => toast.error("Erro ao salvar chave"),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  const valueOf = (key: string) =>
    rows?.find((r) => r.key === key)?.value ?? "";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        Chaves das Lojas (assinaturas)
      </h2>
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Cole aqui a chave pública do RevenueCat de cada loja. Sem ela, o
            botão de assinar não funciona no aplicativo instalado.
          </p>
          {KEYS.map((k) => {
            const saved = valueOf(k.key);
            const current = edits[k.key] ?? saved;
            const dirty = edits[k.key] !== undefined && edits[k.key] !== saved;
            return (
              <div key={k.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {k.icon}
                    {k.label}
                  </Label>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {saved ? "Configurada" : "Pendente"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={current}
                    onChange={(e) =>
                      setEdits((p) => ({ ...p, [k.key]: e.target.value }))
                    }
                    placeholder={k.placeholder}
                    className="h-8 text-sm font-mono"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!dirty || mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ key: k.key, value: edits[k.key].trim() })
                    }
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
