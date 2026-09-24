# Ajustes financeiros, clientes e novos menus Cadastros / Acompanhamentos

## 1. Contas a Pagar — "Vence em"
- À vista: vencimento = data do lançamento.
- Parcelada: vencimento = data da última parcela.
- A lista passa a ser ordenada por essa data (mais próxima primeiro).

## 2. Clientes — filtros
- Remover "Todas". Ficam só **Gestantes** (padrão) e **Puérperas**.

## 3. Novo atendimento — ícones de serviços
- A escolha do serviço volta a mostrar os ícones dos serviços cadastrados, como antes.

## 4. Novo menu CADASTROS
```text
CADASTROS
  - Pessoas     (dados pessoais da cliente: nome, contato, endereço, saúde, acompanhante...)
  - Serviços    (serviços com ícone, usados em Novo atendimento)
```
- **Pessoas**: reaproveita a parte de dados pessoais do formulário atual de Nova Cliente.
- **Serviços**: a gestão de serviços sai de Configurações e vem para cá (mesmos serviços já criados continuam valendo).

## 5. SERVIÇOS → Acompanhamentos (nova página)
```text
SERVIÇOS
  - Acompanhamentos   (novo)
  - Atendimentos
  - Previsões de Recebimento
```
- Lista de acompanhamentos de doulagem em andamento.
- **Novo acompanhamento**: escolher uma cliente já cadastrada, com um botão "+" discreto na mesma linha que abre o cadastro de Pessoas e volta com ela selecionada.
- O resto do formulário usa as informações de acompanhamento de Nova Cliente: situação (gestante/puérpera), DPP/semanas, plano, valor, forma de pagamento, pré-natal, equipe, local de parto, etc.
- Ao salvar, cria uma **previsão de recebimento** com o valor do plano. Em Previsões, "Gerar fatura" define parcelas e vencimentos, como hoje.

## 6. Botão "Nova Cliente" — recomendação
Manter o botão na página Clientes, mas como **atalho** para o fluxo novo, e não como formulário separado:
- Abre o cadastro de Pessoas e, ao salvar, segue direto para Novo acompanhamento com a cliente preenchida.
- Assim a doula continua fazendo tudo de uma vez, sem existirem dois formulários diferentes para manter.
- As clientes já cadastradas continuam exatamente como estão (dados pessoais e de acompanhamento no mesmo registro), sem migração nem risco para parcelas e pagamentos.

## Detalhes técnicos
- Contas a Pagar: calcular o vencimento pelo maior `due_date` em `payments` ligado à transação (se houver parcelas); se não houver, usar `transactions.date`. Ordenação no cliente.
- Clients.tsx / ClientsOverview: tirar o filtro "todas"; estado padrão "gestante".
- Novo atendimento (ServiceRecords): grade de ícones a partir de `custom_services` ativos da organização.
- Pessoas e Acompanhamento continuam gravando em `clients` (mesma tabela, sem mudar o banco): o ClientDialog é dividido em duas partes: `PersonForm` (dados pessoais) e `FollowUpForm` (acompanhamento). Acompanhamento = atualizar os campos de acompanhamento da cliente escolhida.
- Previsão: inserir em `service_records` (status `forecast`, serviço = nome do plano, valor = plan_value). A geração de fatura usa o fluxo existente. A criação automática atual de receita do plano deixa de acontecer nesse caminho, para não duplicar.
- Rotas: `/cadastros/pessoas`, `/cadastros/servicos`, `/servicos/acompanhamentos`; Sidebar com grupo colapsável CADASTROS (oculto para moderadoras, exceto Pessoas, se for preciso); AppPagesDirectory atualizado.
