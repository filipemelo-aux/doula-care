# Cadastro completo e verificado da doula

## Sobre o código de 6 dígitos

O código é gerado pelo próprio sistema e enviado para o e-mail digitado, usando a mesma
estrutura de envio de e-mail já usada na recuperação de senha. A doula recebe a mensagem
na caixa de entrada e digita o número na tela, sem sair do app. Se o e-mail não existir de
verdade, o código nunca chega e a conta não é criada — é isso que barra e-mails falsos.

## 1. Cadastro novo (tela de criar conta)

Passa a ser um formulário em etapas, com validação em cada uma:

1. **Acesso** — nome completo, e-mail profissional, senha.
2. **Verificação do e-mail** — código de 6 dígitos enviado na hora; expira em 15 minutos,
   com botão de reenviar (limitado). Sem código correto, não avança.
3. **Dados pessoais** — CPF (com verificação do dígito), data de nascimento (maior de 18),
   WhatsApp e Instagram (ambos obrigatórios).
4. **Endereço** — CEP (busca automática de cidade/estado), cidade, estado, bairro.
5. **Atuação** — formação/curso de doula, ano de início de atuação, áreas de atendimento,
   breve apresentação.
6. **Foto e consentimento** — foto de perfil e aceite explícito de Política de Privacidade
   e Termos, com data e versão registradas.

A conta só é criada ao final, depois do código validado.

## 2. Bloqueio de e-mails falsos

Além do código, o servidor recusa:
- domínios descartáveis/temporários (lista ampliada);
- domínios que não têm servidor de e-mail configurado (checagem real de DNS);
- endereços obviamente de teste.

## 3. LGPD

- Cada dado coletado tem finalidade declarada na tela de consentimento.
- CPF e data de nascimento ficam visíveis apenas para a própria doula e para a
  administração da plataforma — nunca para clientes ou para outras doulas.
- Registro de consentimento guardado (data, versão do texto).
- Página de perfil permite corrigir os dados; a exclusão da conta já existe hoje.

## 4. Doulas já cadastradas

No próximo login aparece um formulário em tela cheia, sem botão de fechar e sem clique fora,
cobrindo tudo até ser concluído. Texto amigável explicando o porquê: verificação de
identidade profissional, segurança das gestantes, contato direto por WhatsApp e perfil
público completo para receber mais clientes.

Ele traz apenas os campos que faltam, já preenchidos com o que existe hoje. Ao concluir,
fica marcado como completo e nunca mais aparece. Se ela fechar o app antes de terminar,
ele volta no próximo acesso.

## Detalhes técnicos

- **Banco**: novos campos em `profiles` (cpf, data de nascimento, whatsapp, instagram,
  formação, ano de início, consentimento LGPD, `profile_completed_at`) e reuso dos campos
  de endereço/bio/whatsapp/instagram já existentes em `organizations`. Políticas de acesso
  restringindo CPF/nascimento ao próprio usuário e ao super admin.
- **Tabela `email_verifications`**: e-mail, código com hash, expiração, tentativas.
  Sem leitura pelo cliente; só a função de servidor acessa.
- **Funções de servidor**: `send-email-code` (gera + envia código, com limite de envios),
  e `register-doula` alterada para exigir código válido, checar MX do domínio e gravar
  todos os novos campos.
- **Front**: `src/pages/Register.tsx` vira assistente em etapas com esquema de validação
  por etapa; novo `ProfileCompletionGate` montado no layout do admin, dirigido por
  `profile_completed_at`; máscaras de CPF/telefone/CEP reaproveitadas de `src/lib/masks.ts`.
- **Foto**: upload no storage, mesmo fluxo do avatar atual.
