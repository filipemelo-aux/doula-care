# Roadmap

- [x] Apontar edge functions para `STRIPE_LIVE_API_KEY` (fallback `STRIPE_SECRET_KEY`)
- [x] Criar os 4 planos (pro/premium × mensal/anual) em modo live e atualizar `_shared/stripe-plans.ts`
- [x] Criar webhook endpoint em modo live (we_1UFjf0D010uWXrBYcQm2dPwp) e remover função temporária
- [x] Redeploy das funções
- [ ] Teste real com cartão do usuário + estorno (aguardando usuário)
- [x] Reorganizar Acompanhamentos, Atendimentos e Previsões como uma Central de Serviços por etapas
- [x] Validar compilação, navegação e adaptação da Central de Serviços para celular e computador
- [x] Remover as abas internas da Central de Serviços e tornar a linha do tempo dos acompanhamentos dinâmica
- [x] Registrar a entrada recebida ao editar cliente ou acompanhamento, mesmo sem alterar o parcelamento
- [x] Ajustar visualização do acompanhamento no celular, incluir dados da edição e subir aviso de plano bloqueado
- [x] Remover filtros de situação dos Atendimentos e manter o recebimento em Contas a Receber
- [x] Eliminar a etapa de previsão/faturamento dos serviços e registrar recebimentos totais ou parciais em Contas a Receber
- [x] Completar a ficha da cliente com consultas e serviços inclusos sem ação de nova consulta
- [x] Recomendar ficha completa da cliente e detalhes do acompanhamento focados no plano e na execução, sem duplicar dados
