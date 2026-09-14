# Roadmap

- [ ] Apontar edge functions para `STRIPE_LIVE_API_KEY` (create-checkout, check-subscription, customer-portal, stripe-webhook, validate-coupon)
- [ ] Criar os 4 planos (pro/premium × mensal/anual) em modo live e atualizar `_shared/stripe-plans.ts`
- [ ] Criar webhook endpoint em modo live (checkout.session.completed, customer.subscription.*, invoice.payment_*)
- [ ] Redeploy das funções e validação de build
- [ ] Teste real com cartão do usuário + estorno (aguardando usuário)
