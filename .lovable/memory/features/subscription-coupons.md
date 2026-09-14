---
name: Cupons de desconto na assinatura
description: Cupons por organização vinculados a códigos de oferta da App Store / Google Play, criados no Super Admin e resgatados na página de Assinatura
type: feature
---

Tabela `subscription_coupons`: organization_id (obrigatório), code, platform (ios|android|both), discount_percent, description, expires_at, is_active, redeemed_at.

Regras:
- Cupom é **sempre específico de uma doula/organização** (criado pelo Super Admin em Faturamento → Cupons de desconto).
- O `code` **precisa existir como oferta promocional na App Store Connect / Google Play**. O app não calcula desconto — quem aplica é a loja.
- iOS: `presentCodeRedemptionSheet` do RevenueCat, com fallback `https://apps.apple.com/redeem?ctx=offercodes&code=...`.
- Android: `https://play.google.com/redeem?code=...`.
- Web: não há resgate; só mensagem orientando a abrir o app.
- Na página de Assinatura, se a org tem cupom ativo e não expirado, ele aparece pronto para aplicar; senão há campo livre para digitar um código.

Implementação: `AppStoreSubscriptionService.redeemOfferCode`, `src/pages/Subscription.tsx`, `src/components/superadmin/SubscriptionCouponsCard.tsx`.
