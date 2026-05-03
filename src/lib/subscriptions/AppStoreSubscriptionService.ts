/**
 * AppStoreSubscriptionService
 *
 * Camada abstrata para In-App Purchases. Esconde diferenças entre Apple
 * StoreKit, Google Play Billing e o ambiente Web/Preview (mock).
 *
 * A UI NUNCA deve falar diretamente com StoreKit, Google Billing ou
 * RevenueCat — sempre passar por este serviço.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type Platform = "ios" | "android" | "web";
export type BillingPeriod = "monthly" | "yearly";

export interface StoreProduct {
  productId: string;
  planId: string;
  planName: string;
  planSlug: string;
  billingPeriod: BillingPeriod;
  priceString: string;
  priceCents: number;
  currency: string;
}

export interface ActiveSubscriptionInfo {
  productId: string | null;
  planId: string | null;
  planSlug: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  isActive: boolean;
  platform: Platform | "manual" | "free" | "mock";
}

export interface PurchaseResult {
  status: "purchased" | "cancelled" | "pending" | "error";
  productId?: string;
  message?: string;
}

const isNativeMobile = (): boolean => {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android";
};

export const getCurrentPlatform = (): Platform => {
  if (!Capacitor.isNativePlatform()) return "web";
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
};

export const isDevEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    import.meta.env.DEV ||
    window.location.hostname === "localhost" ||
    window.location.hostname.includes("lovable.app") ||
    window.location.hostname.includes("lovableproject.com")
  );
};

// ──────────────────────────────────────────────────────────────────
// Backend helpers
// ──────────────────────────────────────────────────────────────────

async function fetchPlanProductMap(): Promise<StoreProduct[]> {
  const platform = getCurrentPlatform();
  const platformFilter = platform === "web" ? ["ios", "android"] : [platform];

  // Pull both sides: products + plan metadata. We let the UI build prices from
  // platform_plan_limits since the loja prices are configured remotely.
  const { data, error } = await supabase
    .from("plan_store_products" as any)
    .select(
      `id, product_id, platform, billing_period, plan_id,
       plan:platform_plan_limits!inner(id, plan, name, price_monthly, price_yearly)`
    )
    .eq("active", true)
    .in("platform", platformFilter);

  if (error) throw error;

  return ((data as any[]) || []).map((row) => {
    const plan = row.plan as any;
    const cents =
      row.billing_period === "yearly"
        ? plan.price_yearly > 0
          ? plan.price_yearly
          : plan.price_monthly * 12
        : plan.price_monthly;
    return {
      productId: row.product_id,
      planId: row.plan_id,
      planName: plan.name,
      planSlug: plan.plan,
      billingPeriod: row.billing_period as BillingPeriod,
      priceCents: cents,
      currency: "BRL",
      priceString: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100),
    } as StoreProduct;
  });
}

// ──────────────────────────────────────────────────────────────────
// Native bridge (lazy import to keep web bundle clean)
// ──────────────────────────────────────────────────────────────────

async function loadNativePurchases() {
  if (!isNativeMobile()) return null;
  try {
    const mod = await import("@capgo/capacitor-purchases");
    return mod.CapacitorPurchases ?? mod;
  } catch (err) {
    console.warn("[IAP] Plugin not available:", err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

export const AppStoreSubscriptionService = {
  getPlatform: getCurrentPlatform,
  isNativeMobile,
  isDevEnvironment,

  /**
   * Lista os produtos disponíveis para a plataforma atual (mapeados no Supabase).
   * No web devolve produtos das duas lojas para preview/mock.
   */
  async getProducts(): Promise<StoreProduct[]> {
    return fetchPlanProductMap();
  },

  /**
   * Inicia uma assinatura. Em dev/web faz mock. Em iOS/Android usa o plugin.
   */
  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    const platform = getCurrentPlatform();

    if (platform === "web") {
      if (!isDevEnvironment()) {
        return {
          status: "error",
          message:
            "Assinaturas reais só estão disponíveis no aplicativo instalado (App Store ou Google Play).",
        };
      }
      // Dev mock — apenas marca evento, não ativa plano de verdade no backend
      return {
        status: "purchased",
        productId,
        message: "Mock de compra (ambiente de desenvolvimento).",
      };
    }

    const Purchases = await loadNativePurchases();
    if (!Purchases) {
      return {
        status: "error",
        message: "Plugin de compras não disponível neste dispositivo.",
      };
    }

    try {
      // capgo/capacitor-purchases (RevenueCat) API
      const result: any = await (Purchases as any).purchaseProduct({
        productIdentifier: productId,
      });
      if (result?.userCancelled) {
        return { status: "cancelled", productId };
      }
      // Validate server-side
      const validation = await this.validateReceiptOrPurchase({
        platform,
        productId,
        nativeResult: result,
      });
      return validation;
    } catch (err: any) {
      const code = err?.code || err?.userInfo?.code;
      if (code === "1" || /cancel/i.test(err?.message ?? "")) {
        return { status: "cancelled", productId };
      }
      return { status: "error", message: err?.message || "Falha na compra" };
    }
  },

  /**
   * Restaura compras existentes do usuário e sincroniza com o backend.
   */
  async restorePurchases(): Promise<{ restored: boolean; message: string }> {
    const platform = getCurrentPlatform();
    if (platform === "web") {
      return {
        restored: false,
        message: "Restauração só está disponível no app instalado.",
      };
    }
    const Purchases = await loadNativePurchases();
    if (!Purchases) {
      return { restored: false, message: "Plugin de compras indisponível." };
    }
    try {
      const result: any = await (Purchases as any).restorePurchases();
      const sync = await this.syncSubscriptionStatus(result);
      return {
        restored: sync.isActive,
        message: sync.isActive
          ? "Compras restauradas com sucesso."
          : "Nenhuma assinatura ativa encontrada.",
      };
    } catch (err: any) {
      return { restored: false, message: err?.message || "Falha ao restaurar." };
    }
  },

  /**
   * Retorna a assinatura ativa do usuário a partir do backend (fonte da verdade).
   */
  async getActiveSubscription(): Promise<ActiveSubscriptionInfo | null> {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("product_id, plan_id, status, current_period_end, platform")
      .eq("user_id", userId)
      .in("status", ["active", "grace_period"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    let planSlug: string | null = null;
    if (data.plan_id) {
      const { data: plan } = await supabase
        .from("platform_plan_limits" as any)
        .select("plan")
        .eq("id", data.plan_id)
        .maybeSingle();
      planSlug = (plan as any)?.plan ?? null;
    }

    return {
      productId: (data as any).product_id ?? null,
      planId: data.plan_id ?? null,
      planSlug,
      expiresAt: data.current_period_end ?? null,
      willRenew: data.status === "active",
      isActive: data.status === "active" || data.status === "grace_period",
      platform: ((data as any).platform as any) ?? "manual",
    };
  },

  /**
   * Envia recibo/token para validação no backend; backend ativa o plano.
   */
  async validateReceiptOrPurchase(payload: {
    platform: "ios" | "android";
    productId: string;
    nativeResult: any;
  }): Promise<PurchaseResult> {
    const fnName =
      payload.platform === "ios"
        ? "validate-ios-purchase"
        : "validate-android-purchase";

    const transaction =
      payload.nativeResult?.transaction ?? payload.nativeResult ?? {};

    const body =
      payload.platform === "ios"
        ? {
            product_id: payload.productId,
            transaction_id:
              transaction.transactionIdentifier ??
              transaction.transactionId ??
              transaction.id,
            original_transaction_id:
              transaction.originalTransactionIdentifier ??
              transaction.originalTransactionId,
            receipt:
              transaction.appStoreTransactionData ??
              transaction.transactionReceipt ??
              transaction.jwsRepresentation,
          }
        : {
            product_id: payload.productId,
            purchase_token:
              transaction.purchaseToken ?? transaction.token,
            order_id: transaction.orderId ?? transaction.transactionId,
          };

    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) {
      return {
        status: "error",
        message: error.message || "Falha ao validar compra",
      };
    }
    if ((data as any)?.error) {
      return { status: "error", message: (data as any).error };
    }
    return { status: "purchased", productId: payload.productId };
  },

  /**
   * Sincroniza estado vindo do plugin nativo com o backend (usado em restore).
   */
  async syncSubscriptionStatus(nativeInfo?: any): Promise<ActiveSubscriptionInfo> {
    const platform = getCurrentPlatform();
    if (platform === "web") {
      const sub = await this.getActiveSubscription();
      return (
        sub ?? {
          productId: null,
          planId: null,
          planSlug: "free",
          expiresAt: null,
          willRenew: false,
          isActive: false,
          platform: "free",
        }
      );
    }

    // Try to extract first active entitlement from native result
    const customerInfo =
      nativeInfo?.customerInfo ?? nativeInfo?.purchaserInfo ?? nativeInfo;
    const entitlements =
      customerInfo?.entitlements?.active ??
      customerInfo?.activeSubscriptions ??
      [];
    const productId = Array.isArray(entitlements)
      ? entitlements[0]
      : Object.values(entitlements)[0]?.productIdentifier;

    if (productId) {
      await this.validateReceiptOrPurchase({
        platform: platform as "ios" | "android",
        productId,
        nativeResult: customerInfo,
      });
    }

    const sub = await this.getActiveSubscription();
    return (
      sub ?? {
        productId: null,
        planId: null,
        planSlug: "free",
        expiresAt: null,
        willRenew: false,
        isActive: false,
        platform: "free",
      }
    );
  },
};
