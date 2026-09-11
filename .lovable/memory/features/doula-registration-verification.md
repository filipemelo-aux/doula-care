---
name: Cadastro verificado da doula
description: Cadastro em 6 etapas com código de e-mail, dados LGPD e formulário obrigatório para doulas antigas
type: feature
---
- Cadastro (`/cadastro`, `Register.tsx`) em 6 etapas: e-mail → código de 6 dígitos (Supabase OTP via `send-signup-code`) → dados pessoais (nome, CPF validado, nascimento 18+, senha) → contato/endereço (WhatsApp e Instagram OBRIGATÓRIOS, CEP via ViaCEP) → profissional (formação, ano de início, bio, foto) → consentimento LGPD.
- `register-doula` só aceita chamada autenticada (sessão criada pelo OTP), revalida e-mail (blocklist + MX via `_shared/email-guard.ts`), valida CPF e cria organização + papel admin + `doula_personal_data`.
- Dados sensíveis (CPF, nascimento) ficam em `public.doula_personal_data` — visível só para a própria doula e Super Admin. Nunca em `profiles` (que é legível por clientes/colaboradoras da org).
- `profiles.profile_completed_at` / `lgpd_consent_at` / `lgpd_consent_version`; `organizations.doula_training` / `practice_since`.
- `ProfileCompletionGate` (montado no `DashboardLayout`) bloqueia doulas antigas (role admin, sem `profile_completed_at`) com overlay não cancelável; some para sempre após concluir, em qualquer dispositivo.
- Template `magic-link.tsx` exibe o código numérico (`data.token`), não link.
