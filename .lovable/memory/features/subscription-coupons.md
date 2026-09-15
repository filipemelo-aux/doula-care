---
name: Cupons de desconto na assinatura
description: Cupons por organização e por plano, com valor em reais (web/Stripe) e código de oferta das lojas (iOS/Android)
type: feature
---

Tabela `subscription_coupons`: organization_id (nullable = cupom geral), plan_id (FK platform_plan_limits), code, platform (ios|android|both), billing_period (monthly|yearly|both), discount_amount (centavos), duration (once|forever), description, expires_at, is_active, redeemed_at. `discount_percent` descontinuado.

Regras:
- Códigos **repetidos são permitidos**: a identificação é feita por código + plano (+ periodicidade). Cupom exclusivo da doula tem prioridade sobre o geral.
- **Web (Stripe):** o valor em reais definido no Super Admin é aplicado de verdade — `create-checkout` cria um coupon ad-hoc (`amount_off` em BRL, duration once/forever) e passa em `discounts`. Fallback: promotion code criado direto no Stripe.
- **Lojas (iOS/Android):** o `code` precisa existir como oferta promocional na App Store Connect / Google Play; o desconto é definido e exibido pela loja. iOS: `presentCodeRedemptionSheet` + fallback `apps.apple.com/redeem`; Android: `play.google.com/redeem`.
- `validate-coupon` procura primeiro no banco (retorna `offers[]` por plano/período) e só depois no Stripe.

Implementação: `supabase/functions/_shared/db-coupons.ts`, `validate-coupon`, `create-checkout`, `src/components/superadmin/SubscriptionCouponsCard.tsx`, `src/pages/Subscription.tsx`.

Relacionado: `system_config.hide_free_plan` ('true'/'false') — quando true, a tela de Assinatura não exibe o card do plano Free. Interruptor em `PlanLimitsCard.tsx`.

## Atualização (set/2026)
- `discount_type` ('amount' | 'percent'): cupom pode ter desconto em reais (`discount_amount`, centavos) ou em porcentagem (`discount_percent`).
- Cupons **direcionados** (organization_id preenchido) aparecem sozinhos na página de Assinatura da doula; cupons **gerais** (organization_id null) NÃO são exibidos — só funcionam para quem digitar o código.
- O Super Admin pode selecionar várias doulas de uma vez (cria uma linha por doula).
- Pix de assinatura NÃO usa Stripe: QR Code da plataforma (`system_config.platform_pix_*`) via `PixSubscriptionDialog`, registro em `plan_pix_payments`, aprovação em `PixSubscriptionRequestsCard`, acesso de 30 dias/12 meses (`subscriptions.platform = 'pix'`). Disponível apenas no navegador desktop (`isWeb && !useIsMobile()`), nunca no app — evita conflito com a regra 3.1.1 da Apple.
- `usePlanLimits` volta a bloquear o acesso quando uma assinatura com `platform = 'pix'` vence.
