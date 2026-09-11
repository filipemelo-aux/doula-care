# Clientes na ficha da organização

## Objetivo
Transformar o indicador de quantidade de clientes no topo da ficha da organização em uma aba clicável, mantendo uma aba para os dados gerais.

## Alterações
- Adicionar as abas **Dados da organização** e **Clientes (total)** dentro da ficha.
- Carregar as clientes vinculadas exclusivamente à organização aberta.
- Exibir uma lista compacta com nome, contato, situação e DPP quando disponível.
- Manter os dados pessoais, profissionais, equipe e cobrança na aba principal.
- Incluir estados de carregamento e lista vazia, com boa adaptação para celular e computador.

## Detalhes técnicos
- Reaproveitar a consulta já protegida por organização e incluir os campos necessários da tabela de clientes.
- Usar o componente de abas e os padrões visuais existentes no projeto.
- Validar a compilação após a alteração.
