# Recuperação de senha para doulas (e equipe)

## Diagnóstico

Hoje o sistema **não tem nenhum fluxo de "Esqueci minha senha"**:

- A tela de login só oferece "Crie sua conta" e "Já tem a sua doula?" (recuperação de credenciais de cliente por nome + CPF).
- `/recuperar-acesso` serve **apenas para gestantes/clientes**: busca por nome e CPF e devolve usuário/senha provisória. Não funciona para doula admin nem para moderadora.
- Não existe nenhuma chamada de `resetPasswordForEmail` no código, ou seja, o e-mail de redefinição do backend nunca é disparado.
- Não há domínio de e-mail próprio configurado no projeto: os e-mails de autenticação sairiam pelo remetente padrão da plataforma, com limite baixo de envios por hora.

Resultado: a doula que esquece a senha só consegue voltar se o Super Admin resetar manualmente. É exatamente o gargalo relatado.

## Solução proposta

Fluxo padrão de redefinição por e-mail, restrito a contas com e-mail real (doula admin, moderadora, super admin). Clientes continuam no fluxo atual por nome + CPF.

1. **Link na tela de login**: "Esqueci minha senha" abaixo do campo de senha.
2. **Nova página `/esqueci-senha`**: campo de e-mail, envia o e-mail de redefinição e sempre mostra a mesma mensagem de sucesso (não revela se o e-mail existe). Visual igual ao login (logo/branding em cache).
3. **Nova página `/redefinir-senha`**: destino do link do e-mail. Valida a sessão de recuperação, pede nova senha + confirmação, salva e redireciona para a área correta.
4. **Proteções**:
   - Aviso amigável quando o limite de envios por hora for atingido, em vez de erro genérico.
   - Se o e-mail informado pertencer a uma cliente (login por usuário), a mensagem orienta a usar "Já tem a sua doula?".
   - A rota de redefinição precisa passar pelo roteamento sem ser sequestrada pelo redirecionamento automático de sessão.

## Entregabilidade do e-mail

Com o remetente padrão da plataforma o envio funciona, mas com limite baixo por hora e maior chance de cair em spam. Para um fluxo de recuperação confiável em produção, o ideal é configurar o domínio próprio de envio (por exemplo em `doulacare.app.br`) e depois personalizar o template de recuperação com a identidade Terracota/Bege.

Sugestão de execução: implantar o fluxo agora com o remetente padrão (já resolve o gargalo) e, na sequência, configurar o domínio de envio.

## Plano B para casos travados

Manter o reset manual pelo Super Admin como rede de segurança, já validado recentemente (senha temporária testada antes de ser exibida e e-mail confirmado automaticamente).

## Detalhes técnicos

- `src/pages/ForgotPassword.tsx`: `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })`.
- `src/pages/ResetPassword.tsx`: escuta `onAuthStateChange` com evento `PASSWORD_RECOVERY` (e trata o hash/`code` na URL), depois `supabase.auth.updateUser({ password })`.
- Registrar as duas rotas públicas em `src/App.tsx`, antes das rotas protegidas.
- Ajustar o redirect automático do `Login.tsx`/`AuthContext` para não expulsar o usuário da tela de redefinição enquanto a sessão de recuperação estiver ativa.
- Sem migração de banco; nenhuma edge function nova.
