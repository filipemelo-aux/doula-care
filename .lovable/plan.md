# Linha do tempo das consultas (Acompanhamento + Agenda)

## Objetivo
A linha do tempo do card de acompanhamento passa a mostrar **só as consultas do plano**, da 1ª até a última. O faturamento sai desse card. Cada consulta pode ser agendada na Agenda e concluída lá ou no próprio acompanhamento, e as duas áreas ficam sempre iguais.

## 1. Consultas definidas no plano (Configurações → Planos)
Hoje os "serviços inclusos" são um texto livre, por exemplo: "3 encontros comigo pré parto; Parto; Carimbo de placenta". O sistema não tem como saber quantas consultas existem.
- Cada plano ganha uma nova seção, **Roteiro de consultas**, que é uma lista ordenada: nome da consulta, quantidade e tipo (Presencial ou Online).
  - Exemplo: "Encontro pré-parto" x3, "Encontro com Vanessa" x1, "Parto" x1, "Pós-parto" x2.
- Cada item é desmembrado em etapas numeradas: Consulta 1 (Encontro pré-parto 1/3), Consulta 2, e assim por diante.
- O texto de "serviços inclusos" continua igual, porque ele aparece no contrato e para a cliente.
- Se um plano ainda não tiver roteiro, o card mostra um aviso com o atalho "Definir consultas do plano".

## 2. Card do acompanhamento
```text
Maria Silva · Plano Completo                         Gestante
Consultas  ●━━●━━◐━━○━━○━━○       2 de 6 realizadas
Próxima: Encontro pré-parto 3/3 · agendada 28/09 14h
[ Consultas ]  [ Visualizar ]  [ Editar ]
```
- ● realizada · ◐ agendada · ○ pendente
- A linha "Próxima" mostra a próxima consulta e se ela já tem data na agenda.

## 3. Tela "Consultas" (ao tocar no botão)
Traz a lista numerada. Cada consulta tem uma situação e as ações possíveis nela:
- **Pendente**: [Agendar] abre o agendamento com a cliente, o título ("Consulta 3 · Encontro pré-parto") e o endereço já preenchidos. Também tem [Registrar como realizada], para quem não usa a agenda.
- **Agendada**: mostra data e hora, com as opções [Concluir], [Reagendar] e [Cancelar agendamento].
- **Realizada**: mostra a data e as anotações, com as opções [Ver anotações] e [Desfazer].

## 4. Agenda
- Ao criar um compromisso para uma cliente em acompanhamento, aparece o campo opcional **"Vincular à consulta do plano"**, que já sugere a próxima pendente.
- Os compromissos vinculados aparecem na agenda com um selo, por exemplo "Consulta 2/6".
- Concluir o compromisso na Agenda (com as anotações que já existem) marca a consulta como realizada no acompanhamento. Concluir pelo acompanhamento também conclui o compromisso.
- As consultas concluídas continuam entrando na ficha da cliente, como já acontece hoje.
- Excluir ou cancelar o compromisso faz a consulta voltar para "Pendente".

## 5. Fora deste escopo
- O faturamento continua em Financeiro. Ele sai do card de acompanhamento e continua nas páginas de Atendimentos e Previsões.
- Os registros de consultas feitos na versão anterior serão aproveitados sempre que o nome coincidir com um item do roteiro.

## Detalhes técnicos
- Nova tabela `plan_consultations` (plan_setting_id, organization_id, name, quantity, modality, sort_order), com permissões de acesso (grants e RLS) por organização, só para a doula (admin).
- A tabela `followup_sessions` passa a ter `consultation_id`, `sequence` (número da consulta), `appointment_id` (ligação com `appointments`) e `status` (scheduled/done). O `performed_at` passa a poder ficar vazio.
- `appointments` recebe `followup_session_id`, que pode ficar vazio.
- Triggers mantêm as duas áreas iguais: `appointments.completed_at` preenchido faz a sessão virar done; o compromisso excluído faz a sessão voltar para pendente. A conclusão pelo acompanhamento atualiza o compromisso.
- Interface: editor de roteiro em `Plans.tsx`, card e tela de consultas em `FollowUps.tsx` (novo componente `ConsultationTimeline`), e vínculo no diálogo de novo compromisso e selo em `Agenda.tsx`. A lógica de faturamento (`progressFor`) sai do card.
- A moderadora continua sem acesso aos planos. A agenda segue as permissões que já existem.
