# Roadmap

- [x] Apontar edge functions para `STRIPE_LIVE_API_KEY` (fallback `STRIPE_SECRET_KEY`)
- [x] Criar os 4 planos (pro/premium × mensal/anual) em modo live e atualizar `_shared/stripe-plans.ts`
- [x] Criar webhook endpoint em modo live (we_1UFjf0D010uWXrBYcQm2dPwp) e remover função temporária
- [x] Redeploy das funções
- [ ] Teste real com cartão do usuário + estorno (aguardando usuário)
- [ ] Reorganizar Acompanhamentos, Atendimentos e Previsões como uma Central de Serviços por etapas
- [ ] Validar criação de atendimento, faturamento e visualização em celular e computador
