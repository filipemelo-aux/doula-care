import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Ticket, Plus, Trash2, Power, Search } from "lucide-react";
import { maskCurrency, parseCurrency } from "@/lib/masks";

interface CouponRow {
  id: string;
  organization_id: string | null;
  plan_id: string | null;
  code: string;
  platform: string;
  billing_period: string;
  discount_type: string;
  discount_amount: number | null;
  discount_percent: number | null;
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

type Scope = "generic" | "targeted";

export function SubscriptionCouponsCard() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>("generic");
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [planId, setPlanId] = useState("");
  const [code, setCode] = useState("");
  const [platform, setPlatform] = useState("both");
  const [billing, setBilling] = useState("both");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
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

  const filteredOrgs = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    const list = (orgs || []) as any[];
    if (!term) return list;
    return list.filter((o) =>
      `${o.nome_exibicao || ""} ${o.name || ""}`.toLowerCase().includes(term)
    );
  }, [orgs, orgSearch]);

  const orgName = (id: string | null) => {
    if (!id) return "Cupom geral (quem tiver o código)";
    const o = (orgs || []).find((x: any) => x.id === id);
    return o?.nome_exibicao || o?.name || "—";
  };

  const planName = (id: string | null) => {
    if (!id) return "Todos os planos";
    const p = (plans || []).find((x: any) => x.id === id);
    return p?.name || "—";
  };

  const toggleOrg = (id: string) =>
    setSelectedOrgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const createMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseCurrency(amount) * 100);
      const pct = Math.round(Number(percent.replace(",", ".")) || 0);
      const base = {
        plan_id: planId || null,
        code: code.trim().toUpperCase(),
        platform,
        billing_period: billing,
        discount_type: discountType,
        discount_amount: discountType === "amount" && cents > 0 ? cents : null,
        discount_percent: discountType === "percent" && pct > 0 ? pct : null,
        duration,
        description: description.trim() || null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      };

      const rows =
        scope === "generic"
          ? [{ ...base, organization_id: null }]
          : selectedOrgs.map((id) => ({ ...base, organization_id: id }));

      const { error } = await supabase
        .from("subscription_coupons" as any)
        .insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["sa-subscription-coupons"] });
      setCode("");
      setAmount("");
      setPercent("");
      setDescription("");
      setExpires("");
      setSelectedOrgs([]);
      toast.success(count > 1 ? `${count} cupons criados!` : "Cupom criado!");
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

  const hasDiscountValue =
    discountType === "amount"
      ? parseCurrency(amount) > 0
      : Number(percent.replace(",", ".")) > 0;

  const canCreate =
    code.trim().length >= 3 &&
    !!planId &&
    hasDiscountValue &&
    (scope === "generic" || selectedOrgs.length > 0);

  const discountBadge = (c: CouponRow) => {
    if (c.discount_type === "percent" && c.discount_percent) {
      return `−${c.discount_percent}%`;
    }
    if (c.discount_amount) return `−${formatBRL(c.discount_amount)}`;
    return null;
  };

  return (
    <Card className="card-glass">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Cupons de desconto</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Cupons <strong>direcionados</strong> aparecem automaticamente na área de
          assinatura das doulas escolhidas. Cupons <strong>gerais</strong> não são
          exibidos para ninguém: só funcionam para quem já recebeu o código e o digitar.
          O desconto pode ser em reais ou em porcentagem, e códigos repetidos são
          permitidos — a identificação é feita pelo plano escolhido.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de cupom</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">
                  Geral — quem tiver o código aplica
                </SelectItem>
                <SelectItem value="targeted">
                  Direcionado — aparece para doulas específicas
                </SelectItem>
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

          {scope === "targeted" && (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">
                Doulas ({selectedOrgs.length} selecionadas)
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Buscar doula..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl bg-muted/40 p-2 space-y-1">
                <button
                  type="button"
                  className="text-[11px] text-primary px-1 pb-1"
                  onClick={() =>
                    setSelectedOrgs(
                      selectedOrgs.length === filteredOrgs.length
                        ? []
                        : filteredOrgs.map((o: any) => o.id)
                    )
                  }
                >
                  {selectedOrgs.length === filteredOrgs.length
                    ? "Limpar seleção"
                    : "Selecionar todas"}
                </button>
                {filteredOrgs.map((o: any) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-background/60 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedOrgs.includes(o.id)}
                      onCheckedChange={() => toggleOrg(o.id)}
                    />
                    <span className="text-sm text-foreground truncate">
                      {o.nome_exibicao || o.name}
                    </span>
                  </label>
                ))}
                {filteredOrgs.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    Nenhuma doula encontrada.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Código da oferta</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DOULA30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de desconto</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as "amount" | "percent")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">Valor em reais</SelectItem>
                <SelectItem value="percent">Porcentagem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discountType === "amount" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Valor do desconto (R$)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(maskCurrency(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                inputMode="numeric"
                value={percent}
                onChange={(e) =>
                  setPercent(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                placeholder="20"
              />
            </div>
          )}
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
          {scope === "targeted" && selectedOrgs.length > 1
            ? `Criar ${selectedOrgs.length} cupons`
            : "Criar cupom"}
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
                    {discountBadge(c) && (
                      <Badge className="text-[10px]">
                        {discountBadge(c)}
                        {c.duration === "forever" ? " sempre" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {c.organization_id ? "Direcionado" : "Geral"}
                    </Badge>
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
