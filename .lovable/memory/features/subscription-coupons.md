---
name: Cupons de desconto na assinatura
description: Cupons por organização vinculados a códigos de oferta da App Store / Google Play, criados no Super Admin e resgatados na página de Assinatura
type: feature
---

Tabela `subscription_coupons`: organization_id (nullable = cupom geral), code, platform (ios|android|both), description, expires_at, is_active, redeemed_at. `discount_percent` foi descontinuado (coluna nullable, não usada).

Regras:
- Cupom pode ser **específico de uma doula/organização** ou **geral** (organization_id NULL). Cupom exclusivo tem prioridade na exibição.
- **Nunca definir percentual/valor de desconto no app** — o desconto é configurado na oferta promocional da loja e exibido pela própria loja na tela de resgate/checkout. O app só vincula e aplica o código.
- O `code` **precisa existir como oferta promocional na App Store Connect / Google Play**. O app não calcula desconto — quem aplica é a loja.
- iOS: `presentCodeRedemptionSheet` do RevenueCat, com fallback `https://apps.apple.com/redeem?ctx=offercodes&code=...`.
- Android: `https://play.google.com/redeem?code=...`.
- Web: não há resgate; só mensagem orientando a abrir o app.
- Na página de Assinatura, se a org tem cupom ativo e não expirado, ele aparece pronto para aplicar; senão há campo livre para digitar um código.

Implementação: `AppStoreSubscriptionService.redeemOfferCode`, `src/pages/Subscription.tsx`, `src/components/superadmin/SubscriptionCouponsCard.tsx`.
