# Central de Serviços — organização de Acompanhamentos e Atendimentos

## Objetivo
Transformar **Acompanhamentos**, **Atendimentos** e **Previsões de Recebimento** em uma área operacional única e intuitiva, semelhante a uma central profissional de serviços, sem alterar o fluxo financeiro já utilizado.

## Experiência escolhida
- Visual **Terracota clínica**: identidade atual com terracota para ações e verde discreto para etapas concluídas.
- **Nunito** nos títulos e **Figtree** nos textos e informações operacionais.
- Organização em **lista por etapas**, seguindo a direção visual escolhida.
- Linguagem própria para doulas, sem termos técnicos de emissão fiscal que não existam no sistema.

## O que será feito

### 1. Deixar o fluxo claro em todas as páginas
Exibir uma sequência visual consistente:

```text
Acompanhamento contratado
          ↓
Atendimento realizado
          ↓
Previsão de recebimento
          ↓
Fatura gerada
          ↓
Pagamento recebido
```

Cada situação terá nome, cor e ícone consistentes. A doula verá onde cada serviço está e qual é a próxima ação.

### 2. Reorganizar Acompanhamentos
- Cabeçalho com totais de acompanhamentos ativos e valores contratados.
- Busca por cliente e filtros por situação.
- Cada acompanhamento mostrará cliente, plano contratado, valor, DPP quando aplicável e situação financeira.
- Cartão expansível com linha de progresso e ações **Visualizar**, **Editar** e **Registrar atendimento**.
- Estado vazio orientará a cadastrar o primeiro acompanhamento.

### 3. Tornar Atendimentos um registro real de serviços executados
- Resumo com quantidade realizada, valor total, itens a faturar e itens pagos.
- Busca por cliente ou serviço e filtros: **Todos**, **A faturar**, **Faturados** e **Pagos**.
- Lista por data com cliente, serviço, valor, observações e vínculo com o acompanhamento quando existir.
- Cada item mostrará a trilha do atendimento até o pagamento.
- Ações contextuais: visualizar detalhes, faturar quando pendente, abrir a fatura quando já faturado e excluir somente enquanto ainda não faturado.
- O formulário atual de novo atendimento será preservado e receberá uma organização visual mais clara.

### 4. Organizar Previsões de Recebimento
- Resumo do valor total ainda não faturado.
- Busca e filtros por cliente, serviço e período.
- Agrupar previsões por cliente para facilitar a conferência e reduzir cobranças fragmentadas.
- Permitir selecionar um ou vários atendimentos da mesma cliente para gerar uma fatura.
- Mostrar claramente o que será levado para a fatura antes de continuar.

### 5. Conectar as páginas sem duplicar dados
- Adicionar atalhos entre Acompanhamentos, Atendimentos, Previsões e Faturas e Contas a Receber.
- Usar os registros atuais de serviços, transações e pagamentos como fonte; nenhum histórico será recriado ou apagado.
- Manter os pagamentos e estornos funcionando na área financeira atual.

### 6. Estados e uso em telas pequenas
- Estados vazios terão uma única ação principal e explicarão o próximo passo.
- Listas serão compactas no computador e virarão cartões operacionais no celular.
- Ações secundárias ficarão em menu discreto para evitar excesso de botões.
- Transições serão leves e respeitarão a preferência de redução de movimento.

## Detalhes técnicos
- Criar componentes compartilhados para situação, linha de progresso, filtros e resumo operacional.
- Ampliar as consultas atuais apenas com relacionamentos necessários entre acompanhamento, serviço e transação.
- A seleção conjunta para faturamento aceitará somente itens compatíveis da mesma cliente.
- Preservar isolamento por organização, permissões atuais e bloqueio dessas áreas para moderadoras.
- Validar os fluxos completos em celular e computador: criar acompanhamento, registrar atendimento, gerar fatura e registrar pagamento.
