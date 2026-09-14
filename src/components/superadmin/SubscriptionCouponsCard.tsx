import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Ticket, Plus, Trash2, Power } from "lucide-react";

interface CouponRow {
  id: string;
  organization_id: string | null;
  code: string;
  platform: string;
  description: string | null;
  expires_at: string | null;
  is_active: boolean;
  redeemed_at: string | null;
}

const platformLabel: Record<string, string> = {
  ios: "App Store",
  android: "Google Play",
  both: "Ambas as lojas",
};

export function SubscriptionCouponsCard() {
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [code, setCode] = useState("");
  const [platform, setPlatform] = useState("both");
  const [description, setDescription] = useState("");
  const [expires, setExpires] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["sa-orgs-for-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, nome_exibicao")
        .order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["sa-subscription-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_coupons" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as CouponRow[]) || [];
    },
  });

  const orgName = (id: string | null) => {
    if (!id) return "Todas as doulas";
    const o = (orgs || []).find((x: any) => x.id === id);
    return o?.nome_exibicao || o?.name || "—";
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscription_coupons" as any).insert({
        organization_id: orgId === "all" || !orgId ? null : orgId,
        code: code.trim(),
        platform,
        description: description.trim() || null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-subscription-coupons"] });
      setCode("");
      setDescription("");
      setExpires("");
      toast.success("Cupom criado!");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar cupom"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: CouponRow) => {
      const { error } = await supabase
        .from("subscription_coupons" as any)
        .update({ is_active: !row.is_active } as any)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-subscription-coupons"] });
      toast.success("Cupom atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscription_coupons" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-subscription-coupons"] });
      toast.success("Cupom removido");
    },
  });

  const canCreate = code.trim().length >= 3;

  return (
    <Card className="card-glass">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Cupons de desconto</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          O código precisa existir como oferta promocional na App Store Connect /
          Google Play — o valor do desconto é definido e exibido pela loja no
          momento do resgate. Aqui você apenas vincula o código a uma doula
          específica ou o deixa geral, válido para qualquer doula.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Doula / organização</Label>
            <Select value={orgId || "all"} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as doulas (cupom geral)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as doulas (cupom geral)</SelectItem>
                {(orgs || []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome_exibicao || o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código da oferta</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DOULA30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Loja</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Ambas as lojas</SelectItem>
                <SelectItem value="ios">App Store (iOS)</SelectItem>
                <SelectItem value="android">Google Play (Android)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Validade (opcional)</Label>
            <Input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Parceria lançamento"
            />
          </div>
        </div>

        <Button
          size="sm"
          disabled={!canCreate || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Criar cupom
        </Button>

        <div className="space-y-2 pt-2">
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : (coupons || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cupom criado ainda.
            </p>
          ) : (
            (coupons || []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{c.code}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {platformLabel[c.platform] || c.platform}
                    </Badge>
                    {!c.is_active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                    {c.redeemed_at && (
                      <Badge variant="outline" className="text-[10px]">
                        Resgatado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {orgName(c.organization_id)}
                    {c.expires_at
                      ? ` · até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`
                      : ""}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleMutation.mutate(c)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
