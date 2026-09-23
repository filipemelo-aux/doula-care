# Serviços, Atendimentos, Previsões e Faturas

## O que muda para a doula

```text
Menu lateral
  SERVIÇOS  (clicável, abre/fecha)
    - Atendimentos
    - Previsões de Recebimento
  FINANCEIRO (clicável, abre/fecha)
    - Faturas e Contas a Receber   (antiga "Entradas")
    - Despesas / Cobranças / Relatórios
  MEU NEGÓCIO (clicável, abre/fecha)
    - Minha Marca / Localização e Atendimento
```

Fluxo novo:

```text
Atendimento registrado  ->  Previsão de recebimento criada sozinha
Previsão  ->  botão "Gerar fatura"  ->  Fatura aparece em Faturas e Contas a Receber
Fatura  ->  registrar pagamentos (igual hoje: parcelas, valor recebido, forma)
```

1. **Menus colapsáveis**: Financeiro, Meu Negócio e o novo Serviços abrem e fecham ao clicar; o grupo da página atual abre sozinho; a escolha fica lembrada.
2. **Atendimentos** (nova página): tabela com os serviços realizados (data, cliente, serviço, valor, situação: previsto / faturado / pago). O botão "Nova receita de serviço" sai de Entradas e vem para cá como "Novo atendimento".
3. **Previsões de Recebimento** (nova página): lista o que ainda não foi faturado, com total previsto. Em cada uma, "Gerar fatura" (define parcelas e vencimentos, como hoje).
4. **Faturas e Contas a Receber**: a página Entradas renomeada. Continua com contratos e serviços faturados, e o registro de pagamentos continua exatamente como está.
5. **Dados já existentes**: todos os serviços e contratos já cadastrados em Entradas entram como **já faturados**, com as parcelas e pagamentos intactos. Nada é apagado nem recriado. Eles também aparecem em Atendimentos com a situação "Faturado"/"Pago".
6. Moderadoras seguem sem acesso ao financeiro; Atendimentos fica visível para elas sem valores? (vou manter igual ao Financeiro: oculto).

## Detalhes técnicos

- Nova tabela `service_records` (organization_id, client_id, service_date, service_name, custom_service_id opcional, amount, notes, status `forecast|invoiced`, transaction_id nullable -> transactions, created_by). GRANT + RLS por `organization_id` (admin da org; super admin leitura), trigger updated_at.
- A "previsão" é o próprio `service_record` com status `forecast` (sem tabela extra). "Gerar fatura" reaproveita a lógica atual de criação de receita em Financial.tsx (insert em `transactions` + `payments`), depois grava `transaction_id` e `status='invoiced'`.
- Migração de dados: para cada `transactions` tipo receita de serviço (não contrato/auto-gerado) cria um `service_records` status `invoiced` ligado ao transaction_id. Nenhuma alteração em `transactions`/`payments` (regra de integridade de pagamentos).
- Extrair o formulário de receita de serviço de Financial.tsx para um componente compartilhado usado por Atendimentos (novo) e Previsões (gerar fatura).
- Rotas: `/servicos/atendimentos`, `/servicos/previsoes`; `/financeiro` mantém URL com título novo. Sidebar: `subItems` com estado aberto/fechado (localStorage), chevron.
- Atualizar AppPagesDirectory e memória do projeto.
