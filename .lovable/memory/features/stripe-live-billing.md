---
name: Stripe em modo live (cobranças reais web)
description: Chave live STRIPE_LIVE_API_KEY, price IDs reais, webhook live e responsabilidade da FSM nas cobranças web
type: feature
---

Cobranças web (navegador) rodam em modo **live** na conta Stripe da **FSM** (CNPJ próprio do usuário); o app continua com a marca Doula Care. Mobile segue via lojas (App Store/Google Play, RevenueCat), caindo na conta C6 da FSM mas exibindo "Doula Care" na loja.

- Chave: `STRIPE_LIVE_API_KEY` (secret). Todas as funções leem `STRIPE_LIVE_API_KEY ?? STRIPE_SECRET_KEY`.
- Price IDs live em `supabase/functions/_shared/stripe-plans.ts`: pro mensal `price_1UFjexD010uWXrBY9J3J6Y1K`, pro anual `price_1UFjeyD010uWXrBYAHRdeLCj`, premium mensal `price_1UFjezD010uWXrBYkGEMY4cE`, premium anual `price_1UFjf0D010uWXrBYoM7vEZTL` (R$ 44,90 / R$ 449,90 / R$ 64,90 / R$ 649,90, recorrentes).
- Webhook live `we_1UFjf0D010uWXrBYcQm2dPwp` → `/functions/v1/stripe-webhook?t=<STRIPE_WEBHOOK_TOKEN>` com eventos checkout.session.completed, customer.subscription.*, invoice.payment_*.
- Setup foi feito por função temporária `setup-stripe-live` (já removida) protegida por x-setup-token = STRIPE_WEBHOOK_TOKEN.
