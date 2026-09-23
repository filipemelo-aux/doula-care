# Separar Contas a Pagar e Contas Pagas

## Resultado
- Renomear **Despesas** para **Contas a Pagar** no menu e na página.
- Exibir em Contas a Pagar somente despesas ainda pendentes, com ação para registrar o pagamento.
- Criar **Contas Pagas** dentro do grupo Financeiro, mostrando somente despesas quitadas.
- Permitir abrir os detalhes de uma conta paga e estornar o pagamento; após o estorno, ela volta para Contas a Pagar.

## Preservação dos dados atuais
- Reaproveitar os registros financeiros existentes, sem excluir nem recriar lançamentos.
- Considerar as saídas antigas já registradas como pagas, preservando valores, datas, categorias e formas de pagamento.
- Usar o valor pago do próprio lançamento para controlar a separação entre pendente e paga.

## Interface
- Manter o cadastro e a edição na página Contas a Pagar.
- Incluir situação no cadastro: **Pendente** ou **Já paga**.
- Adicionar ações claras de **Pagar**, **Visualizar** e **Estornar**, com confirmação antes do estorno.
- Manter as versões para celular e computador alinhadas ao visual financeiro atual.

## Detalhes técnicos
- Atualizar a rota e o menu sem quebrar o endereço atual de Contas a Pagar.
- Criar uma rota exclusiva para Contas Pagas.
- Atualizar os resumos para calcularem apenas os registros exibidos em cada página.
- Invalidar os dados financeiros após pagamento ou estorno para a conta mudar de página imediatamente.
- Validar compilação e comportamento de pagamento/estorno no preview.
