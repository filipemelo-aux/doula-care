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
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface CouponRow {
  id: string;
  organization_id: string | null;
  plan_id: string | null;
  code: string;
  platform: string;
  billing_period: string;
  discount_amount: number | null;
  duration: string;
  description: string | null;
  expires_at: string | null;
  is_active: boolean;
  redeemed_at: string | null;
}

const platformLabel: Record<string, string> = {
  ios: "App Store",
  android: "Google Play",
  both: "Todas as plataformas",
};

const billingLabel: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
  both: "Mensal e anual",
};

const formatBRL = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SubscriptionCouponsCard() {
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState("all");
  const [planId, setPlanId] = useState("");
  const [code, setCode] = useState("");
  const [platform, setPlatform] = useState("both");
  const [billing, setBilling] = useState("both");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("once");
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

  const { data: plans } = useQuery({
    queryKey: ["sa-plans-for-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_plan_limits" as any)
        .select("id, plan, name, is_free")
        .order("price_monthly");
      if (error) throw error;
      return ((data as any[]) || []).filter((p) => !p.is_free);
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

  const planName = (id: string | null) => {
    if (!id) return "Todos os planos";
    const p = (plans || []).find((x: any) => x.id === id);
    return p?.name || "—";
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseCurrency(amount) * 100);
      const { error } = await supabase.from("subscription_coupons" as any).insert({
        organization_id: orgId === "all" ? null : orgId,
        plan_id: planId || null,
        code: code.trim().toUpperCase(),
        platform,
        billing_period: billing,
        discount_amount: cents > 0 ? cents : null,
        duration,
        description: description.trim() || null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-subscription-coupons"] });
      setCode("");
      setAmount("");
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

  const canCreate = code.trim().length >= 3 && !!planId;

  return (
    <Card className="card-glass">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Cupons de desconto</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Defina o valor do desconto em reais para cada plano. Códigos com o mesmo
          nome são permitidos — a identificação é feita pelo plano escolhido. No
          navegador o desconto é aplicado automaticamente no pagamento por cartão;
          nas lojas (iOS/Android) o código precisa existir como oferta promocional
          na App Store Connect / Google Play.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Doula / organização</Label>
            <Select value={orgId} onValueChange={setOrgId}>
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
            <Label className="text-xs">Plano</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o plano" />
              </SelectTrigger>
              <SelectContent>
                {(plans || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
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
            <Label className="text-xs">Valor do desconto (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(maskCurrency(e.target.value))}
              placeholder="R$ 0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Periodicidade</Label>
            <Select value={billing} onValueChange={setBilling}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Mensal e anual</SelectItem>
                <SelectItem value="monthly">Somente mensal</SelectItem>
                <SelectItem value="yearly">Somente anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Aplicar desconto</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Só na primeira cobrança</SelectItem>
                <SelectItem value="forever">Em todas as cobranças</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Todas as plataformas</SelectItem>
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
          <div className="space-y-1.5 md:col-span-2">
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
                    <Badge variant="secondary" className="text-[10px]">
                      {planName(c.plan_id)}
                    </Badge>
                    {c.discount_amount ? (
                      <Badge className="text-[10px]">
                        −{formatBRL(c.discount_amount)}
                        {c.duration === "forever" ? " sempre" : ""}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {billingLabel[c.billing_period] || c.billing_period}
                    </Badge>
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
