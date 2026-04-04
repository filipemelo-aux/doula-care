import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, ArrowLeft, BookOpen, Users, CalendarDays, Wallet, MessageCircle, Bell, Shield, Settings, Smartphone, Heart, FileText, TrendingUp, TrendingDown, Users2, Baby, Clock, Star, Database, Lock, Zap, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ id, title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card id={id} className="border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 lg:p-6 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-lg lg:text-xl font-bold text-foreground flex-1">{title}</h2>
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="pt-0 px-4 lg:px-6 pb-6 animate-fade-in">
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="font-semibold text-foreground mb-2 text-base">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const tocItems = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "arquitetura", label: "Arquitetura" },
  { id: "autenticacao", label: "Autenticação e Papéis" },
  { id: "painel-doula", label: "Painel da Doula" },
  { id: "gestao-clientes", label: "Gestão de Clientes" },
  { id: "agenda", label: "Agenda" },
  { id: "financeiro", label: "Financeiro" },
  { id: "mensagens", label: "Mensagens e Notificações" },
  { id: "portal-gestante", label: "Portal da Gestante" },
  { id: "comunidade", label: "Comunidade (Fórum)" },
  { id: "planos", label: "Planos e Limites" },
  { id: "super-admin", label: "Super Admin" },
  { id: "pwa", label: "PWA e Push" },
  { id: "seguranca", label: "Segurança" },
  { id: "tecnologias", label: "Stack Tecnológica" },
];

export default function Documentation() {
  const exportPdf = useCallback(async () => {
    toast.info("Gerando PDF...");
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = 210, margin = 18, cw = pw - margin * 2;
    let y = margin;
    const primary: [number, number, number] = [195, 74, 28];
    const dark: [number, number, number] = [30, 30, 30];
    const muted: [number, number, number] = [100, 100, 100];

    const checkPage = (need: number) => {
      if (y + need > 280) { doc.addPage(); y = margin; }
    };

    const addTitle = (text: string) => {
      checkPage(16);
      doc.setFillColor(...primary);
      doc.rect(margin, y, cw, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(text, margin + 4, y + 7);
      y += 14;
      doc.setTextColor(...dark);
    };

    const addSubtitle = (text: string) => {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...primary);
      doc.text(text, margin, y + 5);
      y += 9;
      doc.setTextColor(...dark);
    };

    const addText = (text: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...muted);
      const lines = doc.splitTextToSize(text, cw - 4);
      checkPage(lines.length * 4.5 + 2);
      doc.text(lines, margin + 2, y + 4);
      y += lines.length * 4.5 + 3;
      doc.setTextColor(...dark);
    };

    const addBullets = (items: string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      items.forEach((item) => {
        const lines = doc.splitTextToSize(item, cw - 10);
        checkPage(lines.length * 4.2 + 2);
        doc.text("•", margin + 3, y + 4);
        doc.text(lines, margin + 8, y + 4);
        y += lines.length * 4.2 + 1.5;
      });
      y += 2;
      doc.setTextColor(...dark);
    };

    // Cover
    doc.setFillColor(...primary);
    doc.rect(0, 0, pw, 297, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text("Doula Care", pw / 2, 100, { align: "center" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("Documentação Completa", pw / 2, 115, { align: "center" });
    doc.setFontSize(11);
    doc.text("Versão 1.2.2", pw / 2, 130, { align: "center" });
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pw / 2, 140, { align: "center" });
    doc.setFontSize(9);
    doc.text("© 2025 Doula Care. Todos os direitos reservados.", pw / 2, 270, { align: "center" });
    doc.addPage();
    y = margin;

    // TOC
    addTitle("Índice");
    const sections = [
      "1. Visão Geral do Sistema", "2. Arquitetura Multi-Tenant", "3. Autenticação e Papéis",
      "4. Painel da Doula (Admin)", "5. Gestão de Clientes", "6. Agenda",
      "7. Financeiro", "8. Mensagens e Notificações", "9. Portal da Gestante",
      "10. Comunidade (Fórum)", "11. Planos e Limites", "12. Super Admin",
      "13. PWA e Push Notifications", "14. Segurança", "15. Stack Tecnológica",
    ];
    addBullets(sections);
    doc.addPage();
    y = margin;

    // 1
    addTitle("1. Visão Geral do Sistema");
    addSubtitle("O que é o Doula Care?");
    addText("O Doula Care é uma plataforma web e mobile (PWA) projetada para doulas gerenciarem seus atendimentos de forma completa. Ele oferece um painel administrativo para a doula e um portal dedicado para cada cliente. No sistema, chamamos de \"cliente\" toda pessoa atendida pela doula — seja ela gestante, puérpera, tentante ou qualquer outro tipo de acompanhamento. A cliente acessa seu próprio portal (Portal da Gestante) para acompanhar sua jornada.");
    addSubtitle("Público-Alvo");
    addBullets(["Doulas profissionais que desejam organizar suas clientes, consultas, financeiro e comunicação em um só lugar", "Clientes (gestantes, puérperas, tentantes e outros perfis) que querem acompanhar sua jornada com diário, contrações, contratos e serviços", "Equipes de doulagem com suporte a múltiplos colaboradores (moderadores)"]);
    addSubtitle("Identidade Visual");
    addText("Cores primárias: terracota (#c34a1c) e bege (#ebe2dc). Tipografia: Nunito para títulos. Cada organização pode personalizar logo, nome de exibição e cores via configurações de branding.");

    // 2
    addTitle("2. Arquitetura Multi-Tenant");
    addSubtitle("Modelo de Dados");
    addText("Cada doula cadastrada opera dentro de uma organização isolada. Todos os dados (clientes, consultas, transações, notificações) são vinculados a um organization_id, garantindo isolamento completo entre doulas.");
    addSubtitle("Isolamento via RLS");
    addText("Row Level Security (RLS) no banco de dados garante que cada usuário só acesse dados da sua organização. Triggers automáticos preenchem o organization_id em inserções, e políticas impedem alteração do campo.");
    addSubtitle("Tabelas Principais");
    addBullets(["organizations — dados da doula/empresa, plano, status, branding", "profiles — perfil do usuário autenticado, vinculado à organização", "user_roles — papéis (admin, moderator, client, super_admin)", "clients — dados completos das gestantes/clientes", "appointments — consultas agendadas", "transactions — receitas e despesas", "payments — parcelas de pagamento", "client_notifications — mensagens e notificações para clientes", "pregnancy_diary — diário da gestação", "contractions — registro de contrações", "client_contracts — contratos com assinatura digital", "service_requests — solicitações de serviços extras", "custom_services — serviços personalizados da doula", "doula_availability — disponibilidade na agenda", "forum_posts / forum_comments / forum_reactions — comunidade", "plan_settings — planos de atendimento configuráveis", "push_subscriptions — assinaturas de push notification", "org_billing — cobranças da plataforma", "org_promotions — promoções e período de trial"]);

    // 3
    addTitle("3. Autenticação e Papéis");
    addSubtitle("Login Unificado");
    addText("Uma única tela de login atende todos os perfis. O sistema identifica automaticamente o papel do usuário e redireciona para o painel correspondente.");
    addBullets(["admin / moderator → /admin (Painel da Doula)", "client → /gestante (Portal da Gestante)", "super_admin → /super-admin (Painel Global)"]);
    addSubtitle("Papéis do Sistema");
    addBullets(["admin — Doula proprietária da organização. Acesso total.", "moderator — Colaborador da doula. Acesso ao painel com algumas restrições.", "client — Gestante/cliente. Acesso ao portal exclusivo.", "super_admin — Administrador global da plataforma."]);
    addSubtitle("Primeiro Acesso (Cliente)");
    addText("Quando uma doula cadastra um cliente, o sistema cria automaticamente uma conta de acesso. No primeiro login, o cliente é forçado a alterar a senha antes de acessar qualquer funcionalidade.");
    addSubtitle("Status da Organização");
    addBullets(["ativo — acesso normal ao sistema", "pendente — cadastro aguardando aprovação do Super Admin", "suspenso — conta bloqueada pela administração"]);

    // 4
    addTitle("4. Painel da Doula (Admin)");
    addSubtitle("Dashboard (Visão Geral)");
    addBullets(["Cards de métricas: total de clientes, consultas do mês, receita, despesas", "Lista de próximas consultas com status", "Clientes recentes cadastrados", "Alerta de nascimento iminente (baseado na DPP)", "Resumo financeiro com gráficos", "Ranking de planos mais vendidos", "Filtro por período (mês, trimestre, ano, personalizado)"]);
    addSubtitle("Menu Lateral (Sidebar)");
    addBullets(["Visão Geral — Dashboard principal", "Notificações — Centro de notificações com badges de não-lidas", "Clientes — Cadastro e gestão completa", "Agenda — Calendário de consultas e disponibilidade", "Financeiro → Receitas, Despesas e Relatórios", "Mensagens — Chat com clientes", "Comunidade — Fórum compartilhado", "Configurações — Branding, PIX, acesso de clientes"]);

    // 5
    addTitle("5. Gestão de Clientes");
    addSubtitle("Cadastro Completo");
    addBullets(["Dados pessoais: nome, CPF, telefone, endereço completo", "Dados da gestação: semanas, DPP, tipo pré-natal", "Status: tentante, gestante, lactante, outro (com status customizado)", "Acompanhante e fotógrafa: nome, telefone, Instagram", "Equipe pré-natal configurável", "Alergias, comorbidades, restrições de aromaterapia", "Instagram da gestante e acompanhante", "Nomes de bebê planejados"]);
    addSubtitle("Planos de Atendimento");
    addText("A doula configura planos (básico, intermediário, completo, avulso) com valores, descrições e funcionalidades incluídas. Ao cadastrar um cliente, vincula-o a um plano e define o valor e método de pagamento.");
    addSubtitle("Funcionalidades por Cliente");
    addBullets(["Detalhes completos com edição inline", "Gerenciar consultas (agendar, completar, adicionar observações)", "Enviar notificações e mensagens com anexos", "Registrar nascimento (data, hora, peso, altura, local, nomes)", "Visualizar diário da gestação e contrações", "Criar e enviar contratos com assinatura digital", "Gerenciar pagamentos e parcelas", "Criar acesso de login para o portal", "Arquivos e documentos"]);

    // 6
    addTitle("6. Agenda");
    addSubtitle("Calendário");
    addBullets(["Visualização mensal com indicadores de consultas por dia", "Criação rápida de consultas com data, hora, cliente, título e endereço", "Marcação de consulta como concluída com notas de conclusão", "Edição e exclusão de consultas"]);
    addSubtitle("Disponibilidade");
    addText("A doula configura sua disponibilidade por data e faixa de horário. Os clientes podem solicitar agendamento nos horários disponíveis via portal.");
    addSubtitle("Solicitações de Agendamento");
    addText("Clientes podem solicitar consultas pelo portal. A doula recebe as solicitações pendentes na aba de agenda e pode aprovar, recusar ou reagendar.");
    addSubtitle("Lembretes Automáticos");
    addBullets(["Lembrete 24h antes da consulta via push notification", "Lembrete 1h antes da consulta via push notification", "Edge Function agendada (check-appointment-reminders) processa os lembretes"]);

    // 7
    addTitle("7. Financeiro");
    addSubtitle("Receitas");
    addBullets(["Registro de transações de receita vinculadas a clientes", "Suporte a parcelamento com controle de parcelas individuais", "Métodos de pagamento: PIX, cartão, dinheiro, transferência, boleto", "Detalhamento de valores recebidos vs. valores totais", "Status automático: pendente, parcial, pago (sincronizado com o cliente)"]);
    addSubtitle("Despesas");
    addBullets(["Categorias: social media, filmmaker, marketing, material hospitalar, escritório, transporte, formação, equipamentos, serviços terceiros, outros", "Tipos: material de trabalho, serviços contratados", "Filtros por período e categoria"]);
    addSubtitle("Relatórios");
    addBullets(["Resumo financeiro por período", "Exportação em Excel e PDF", "Gráficos de receita vs despesa (Recharts)", "Visão geral do faturamento no dashboard"]);
    addSubtitle("Configuração PIX");
    addText("A doula configura sua chave PIX (CPF/CNPJ, e-mail, telefone, aleatória) nas configurações. O sistema gera QR Code PIX (padrão EMV) para facilitar pagamentos dos clientes.");

    // 8
    addTitle("8. Mensagens e Notificações");
    addSubtitle("Sistema de Mensagens");
    addBullets(["Chat bidirecional entre doula e cada cliente", "Suporte a anexos (imagens, documentos) via storage", "Contagem de mensagens não lidas com badges em tempo real", "Separação entre mensagens e notificações gerais"]);
    addSubtitle("Notificações");
    addBullets(["Notificações in-app com listener em tempo real (Realtime)", "Push notifications via Web Push (VAPID) e Firebase Cloud Messaging", "Notificações nativas via Capacitor para apps compilados", "Banner de notificação no topo da tela", "Centro de notificações com histórico completo"]);
    addSubtitle("Tipos de Notificação");
    addBullets(["Lembretes de consulta (24h e 1h antes)", "Vencimento de pagamento", "Nova mensagem da doula ou do cliente", "Solicitação de serviço", "Contrato disponível para assinatura", "Orçamento enviado", "Alerta de trabalho de parto"]);

    // 9
    addTitle("9. Portal da Gestante");
    addSubtitle("Visão Geral");
    addText("Portal mobile-first exclusivo para clientes, acessado via /gestante. Layout dedicado com menu inferior e branding personalizado da doula.");
    addSubtitle("Funcionalidades");
    addBullets(["Dashboard com informações da gestação, semanas, DPP e próximas consultas", "Diário da gestação — registros diários com emoção, sintomas e observações", "Cronômetro de contrações — início/fim com cálculo de duração e intervalo", "Botão de trabalho de parto — alerta a doula em tempo real", "Consultas — visualização e solicitação de agendamento", "Serviços extras — solicitação de serviços com data preferida", "Mensagens — chat direto com a doula", "Documentos — contratos pendentes e assinados", "Perfil — dados pessoais, avatar, informações do acompanhante", "Comunidade — acesso ao fórum compartilhado"]);
    addSubtitle("Contrato Digital");
    addText("A doula cria contratos com conteúdo editável (editor rich text). O cliente recebe a notificação, visualiza o contrato e assina digitalmente com nome completo e IP registrado.");
    addSubtitle("Pagamentos");
    addBullets(["Visualização de parcelas pendentes e pagas", "QR Code PIX gerado automaticamente para pagamento", "Alerta de pagamento em atraso no topo do portal"]);

    // 10
    addTitle("10. Comunidade (Fórum)");
    addBullets(["Categorias configuráveis com ícones", "Posts com título, conteúdo e imagem opcional", "Comentários em posts", "Reações (curtidas) em posts e comentários", "Opção de post anônimo", "Posts fixados (pinned) pelo admin", "Moderação: ocultar posts e comentários", "Audiência: público (todos) ou restrito à organização", "Perfis com identificação de doulas (badge especial)", "Preview de links do Instagram integrado"]);

    // 11
    addTitle("11. Planos e Limites da Plataforma");
    addSubtitle("Planos Disponíveis");
    addBullets(["Free — Funcionalidades básicas, limite de clientes", "Pro — Mais clientes, push notifications, relatórios, exportação", "Premium — Tudo liberado, múltiplos colaboradores, sem limites"]);
    addSubtitle("Limites Configuráveis");
    addBullets(["Máximo de clientes por plano", "Máximo de colaboradores", "Acesso a módulos: agenda, financeiro, despesas, relatórios, mensagens, notificações, push", "Exportação de relatórios", "Precificação por ciclo de cobrança (mensal, trimestral, anual)"]);
    addSubtitle("Promoções");
    addText("Sistema de promoções com suporte a trial period e bônus. Beta testers e parceiros podem receber planos premium vitalícios ou temporários.");

    // 12
    addTitle("12. Super Admin");
    addSubtitle("Dashboard Global");
    addBullets(["Métricas de crescimento: total de organizações, distribuição de planos", "Top organizações mais ativas (baseado em log de acesso)", "Contagem de clientes por organização", "Clientes online em tempo real (Presence)"]);
    addSubtitle("Gestão de Organizações");
    addBullets(["Aprovar novas doulas (status pendente → ativo)", "Alterar plano de uma organização (Free, Pro, Premium)", "Suspender ou reativar contas", "Excluir organizações (com cascade de dados)", "Gerenciar cobranças e notificações da plataforma"]);
    addSubtitle("Moderação de Conteúdo");
    addBullets(["Visualizar mensagens, notificações, diários, contratos e transações de qualquer organização", "Moderar posts e comentários do fórum", "Gerenciar categorias do fórum"]);
    addSubtitle("Gestão de Usuários");
    addBullets(["Listar todos os usuários do sistema", "Gerenciar papéis (admin, moderator, client, super_admin)", "Criar e remover usuários administradores", "Broadcast de notificações para todas as organizações"]);

    // 13
    addTitle("13. PWA e Push Notifications");
    addSubtitle("Progressive Web App");
    addBullets(["Instalável em dispositivos móveis e desktop", "Service Worker com cache inteligente (Workbox)", "Atualização automática com prompt de nova versão", "Orientação retrato, display standalone", "Runtime caching para API do backend", "Versionamento automático com sufixo de build (DDMM.N)"]);
    addSubtitle("Push Notifications");
    addBullets(["Web Push via protocolo VAPID (chaves geradas por Edge Function)", "Suporte a Firebase Cloud Messaging como fallback", "Capacitor Push Notifications para apps nativos (iOS/Android)", "Prompt inteligente de permissão com modal explicativo", "Toggle de push por dispositivo", "Edge Function dedicada para envio server-side"]);
    addSubtitle("App Nativo (Capacitor)");
    addBullets(["Build para iOS e Android via Capacitor", "Status bar e navigation bar customizados", "Deep links e asset links configurados", "Force update listener para versões obrigatórias"]);

    // 14
    addTitle("14. Segurança");
    addSubtitle("Autenticação");
    addBullets(["Autenticação com sessão persistente", "Refresh automático de tokens", "Verificação de e-mail obrigatória (sem auto-confirm)", "Recuperação de credenciais por e-mail", "Exclusão de conta pelo próprio usuário"]);
    addSubtitle("Autorização");
    addBullets(["Row Level Security (RLS) em todas as tabelas", "Função SECURITY DEFINER has_role() para verificação de papéis sem recursão", "Trigger para impedir alteração de organization_id", "Trigger para restringir campos editáveis por clientes", "Prevenção de papéis conflitantes (super_admin + admin)", "Isolamento completo entre organizações"]);
    addSubtitle("Edge Functions");
    addBullets(["Operações sensíveis (criação de usuários, exclusão) via Edge Functions server-side", "Chaves de serviço nunca expostas ao client", "Validação de permissões no servidor para operações críticas"]);

    // 15
    addTitle("15. Stack Tecnológica");
    addSubtitle("Frontend");
    addBullets(["React 18 com TypeScript 5", "Vite 5 como bundler", "Tailwind CSS v3 com design tokens semânticos", "shadcn/ui (Radix UI) para componentes", "React Router v6 para navegação", "TanStack Query (React Query) para cache e data fetching", "Recharts para gráficos", "date-fns para manipulação de datas", "jsPDF + jsPDF-AutoTable para geração de PDFs", "write-excel-file para exportação Excel", "qrcode.react para QR Codes PIX", "react-easy-crop para recorte de imagens", "react-hook-form + zod para formulários", "Lucide React para ícones"]);
    addSubtitle("Backend");
    addBullets(["PostgreSQL como banco de dados", "Autenticação integrada", "Realtime para dados em tempo real e presence", "Storage para arquivos e imagens", "Edge Functions (Deno) para lógica server-side", "Row Level Security (RLS) para isolamento de dados"]);
    addSubtitle("Edge Functions Disponíveis");
    addBullets(["create-admin-user, create-client-user, delete-client-user", "delete-organization, register-doula, manage-admin-user", "provision-existing-clients, resolve-client-login", "recover-client-credentials, reset-admin-password, reset-client-password", "send-push-notification, get-vapid-public-key, generate-vapid-keys", "check-appointment-reminders, check-payment-due-dates, check-billing-overdue", "cleanup-orphan-users, generate-notification-text, generate-service-icon", "notify-forum-post, respond-budget, request-account-deletion"]);
    addSubtitle("Infraestrutura");
    addBullets(["Hospedagem: Lovable Cloud", "PWA com Service Worker (Workbox)", "Capacitor para builds nativos iOS/Android", "Versionamento semântico: X.Y.Z.DDMM.N"]);

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Doula Care — Documentação v1.2.2`, margin, 290);
      doc.text(`Página ${i} de ${totalPages}`, pw - margin, 290, { align: "right" });
    }

    doc.save("Doula_Care_Documentacao_v1.2.2.pdf");
    toast.success("PDF exportado com sucesso!");
  }, []);

  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-bold text-foreground">Documentação — Doula Care</h1>
          <Badge variant="secondary" className="ml-auto text-xs">v1.2.2</Badge>
          <Button variant="outline" size="sm" onClick={exportPdf} className="gap-2 ml-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* TOC sidebar */}
        <nav className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Índice</p>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1 truncate"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Intro */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">Doula Care — Documentação Completa</h1>
            <p className="text-muted-foreground leading-relaxed">
              Documentação técnica e funcional da plataforma Doula Care, um sistema SaaS multi-tenant para gestão
              de atendimentos de doulas, com portal exclusivo para gestantes, puérperas e clientes.
            </p>
          </div>

          {/* 1. Visão Geral */}
          <CollapsibleSection id="visao-geral" title="Visão Geral do Sistema" icon={<BookOpen className="h-5 w-5 text-primary" />} defaultOpen>
            <SubSection title="O que é o Doula Care?">
              <p>
                O Doula Care é uma plataforma web e mobile (PWA) projetada para <strong>doulas</strong> gerenciarem seus atendimentos
                de forma completa. Ele oferece um painel administrativo para a doula e um portal dedicado para cada
                <strong> cliente</strong>. No sistema, chamamos de "cliente" toda pessoa atendida pela doula — seja ela gestante,
                puérpera, tentante ou qualquer outro tipo de acompanhamento. A cliente acessa seu próprio portal
                (Portal da Gestante) para acompanhar sua jornada.
              </p>
            </SubSection>
            <SubSection title="Público-Alvo">
              <FeatureList items={[
                "Doulas profissionais que desejam organizar suas clientes, consultas, financeiro e comunicação em um só lugar",
                "Clientes (gestantes, puérperas, tentantes e outros perfis) que querem acompanhar sua jornada com diário, contrações, contratos e serviços",
                "Equipes de doulagem com suporte a múltiplos colaboradores (moderadores)",
              ]} />
            </SubSection>
            <SubSection title="Identidade Visual">
              <p>
                Cores primárias: terracota (#c34a1c) e bege (#ebe2dc). Tipografia: Nunito para títulos.
                Cada organização pode personalizar logo, nome de exibição e cores via configurações de branding.
              </p>
            </SubSection>
          </CollapsibleSection>

          {/* 2. Arquitetura */}
          <CollapsibleSection id="arquitetura" title="Arquitetura Multi-Tenant" icon={<Database className="h-5 w-5 text-primary" />}>
            <SubSection title="Modelo de Dados">
              <p>
                Cada doula cadastrada opera dentro de uma <strong>organização</strong> isolada. Todos os dados
                (clientes, consultas, transações, notificações) são vinculados a um <code>organization_id</code>,
                garantindo isolamento completo entre doulas.
              </p>
            </SubSection>
            <SubSection title="Isolamento via RLS">
              <p>
                Row Level Security (RLS) no banco de dados garante que cada usuário só acesse dados da sua
                organização. Triggers automáticos preenchem o <code>organization_id</code> em inserções,
                e políticas impedem alteração do campo.
              </p>
            </SubSection>
            <SubSection title="Tabelas Principais">
              <FeatureList items={[
                "organizations — dados da doula/empresa, plano, status, branding",
                "profiles — perfil do usuário autenticado, vinculado à organização",
                "user_roles — papéis (admin, moderator, client, super_admin)",
                "clients — dados completos das gestantes/clientes",
                "appointments — consultas agendadas",
                "transactions — receitas e despesas",
                "payments — parcelas de pagamento",
                "client_notifications — mensagens e notificações para clientes",
                "pregnancy_diary — diário da gestação",
                "contractions — registro de contrações",
                "client_contracts — contratos com assinatura digital",
                "service_requests — solicitações de serviços extras",
                "custom_services — serviços personalizados da doula",
                "doula_availability — disponibilidade na agenda",
                "forum_posts / forum_comments / forum_reactions — comunidade",
                "plan_settings — planos de atendimento configuráveis",
                "push_subscriptions — assinaturas de push notification",
                "org_billing — cobranças da plataforma para a organização",
                "org_promotions — promoções e período de trial",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 3. Autenticação */}
          <CollapsibleSection id="autenticacao" title="Autenticação e Papéis" icon={<Lock className="h-5 w-5 text-primary" />}>
            <SubSection title="Login Unificado">
              <p>
                Uma única tela de login (<code>/login</code>) atende todos os perfis. O sistema identifica
                automaticamente o papel do usuário e redireciona para o painel correspondente:
              </p>
              <FeatureList items={[
                "admin / moderator → /admin (Painel da Doula)",
                "client → /gestante (Portal da Gestante)",
                "super_admin → /super-admin (Painel Global)",
              ]} />
            </SubSection>
            <SubSection title="Papéis do Sistema">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {[
                  { role: "admin", desc: "Doula proprietária da organização. Acesso total." },
                  { role: "moderator", desc: "Colaborador da doula. Acesso ao painel com algumas restrições." },
                  { role: "client", desc: "Gestante/cliente. Acesso ao portal exclusivo." },
                  { role: "super_admin", desc: "Administrador global da plataforma." },
                ].map((r) => (
                  <div key={r.role} className="p-3 rounded-lg bg-muted/50 border border-border/30">
                    <Badge variant="outline" className="mb-1 text-xs">{r.role}</Badge>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Primeiro Acesso (Cliente)">
              <p>
                Quando uma doula cadastra um cliente, o sistema cria automaticamente uma conta de acesso.
                No primeiro login, o cliente é forçado a alterar a senha antes de acessar qualquer funcionalidade.
              </p>
            </SubSection>
            <SubSection title="Status da Organização">
              <FeatureList items={[
                "ativo — acesso normal ao sistema",
                "pendente — cadastro aguardando aprovação do Super Admin",
                "suspenso — conta bloqueada pela administração",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 4. Painel da Doula */}
          <CollapsibleSection id="painel-doula" title="Painel da Doula (Admin)" icon={<Heart className="h-5 w-5 text-primary" />}>
            <SubSection title="Dashboard (Visão Geral)">
              <FeatureList items={[
                "Cards de métricas: total de clientes, consultas do mês, receita, despesas",
                "Lista de próximas consultas com status",
                "Clientes recentes cadastrados",
                "Alerta de nascimento iminente (baseado na DPP)",
                "Resumo financeiro com gráficos",
                "Ranking de planos mais vendidos",
                "Filtro por período (mês, trimestre, ano, personalizado)",
              ]} />
            </SubSection>
            <SubSection title="Menu Lateral (Sidebar)">
              <FeatureList items={[
                "Visão Geral — Dashboard principal",
                "Notificações — Centro de notificações com badges de não-lidas",
                "Clientes — Cadastro e gestão completa",
                "Agenda — Calendário de consultas e disponibilidade",
                "Financeiro → Receitas, Despesas e Relatórios",
                "Mensagens — Chat com clientes",
                "Comunidade — Fórum compartilhado",
                "Configurações — Branding, PIX, acesso de clientes",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 5. Gestão de Clientes */}
          <CollapsibleSection id="gestao-clientes" title="Gestão de Clientes" icon={<Users className="h-5 w-5 text-primary" />}>
            <SubSection title="Cadastro Completo">
              <FeatureList items={[
                "Dados pessoais: nome, CPF, telefone, endereço completo",
                "Dados da gestação: semanas, DPP (data provável do parto), tipo pré-natal",
                "Status: tentante, gestante, lactante, outro (com status customizado)",
                "Acompanhante e fotógrafa: nome, telefone, Instagram",
                "Equipe pré-natal configurável",
                "Alergias, comorbidades, restrições de aromaterapia",
                "Instagram da gestante e acompanhante",
                "Nomes de bebê planejados",
              ]} />
            </SubSection>
            <SubSection title="Planos de Atendimento">
              <p>
                A doula configura planos (básico, intermediário, completo, avulso) com valores, descrições e
                funcionalidades incluídas. Ao cadastrar um cliente, vincula-o a um plano e define o valor e
                método de pagamento.
              </p>
            </SubSection>
            <SubSection title="Funcionalidades por Cliente">
              <FeatureList items={[
                "Detalhes completos com edição inline",
                "Gerenciar consultas (agendar, completar, adicionar observações)",
                "Enviar notificações e mensagens com anexos",
                "Registrar nascimento (data, hora, peso, altura, local, nomes)",
                "Visualizar diário da gestação e contrações",
                "Criar e enviar contratos com assinatura digital",
                "Gerenciar pagamentos e parcelas",
                "Criar acesso de login para o portal",
                "Arquivos e documentos",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 6. Agenda */}
          <CollapsibleSection id="agenda" title="Agenda" icon={<CalendarDays className="h-5 w-5 text-primary" />}>
            <SubSection title="Calendário">
              <FeatureList items={[
                "Visualização mensal com indicadores de consultas por dia",
                "Criação rápida de consultas com data, hora, cliente, título e endereço",
                "Marcação de consulta como concluída com notas de conclusão",
                "Edição e exclusão de consultas",
              ]} />
            </SubSection>
            <SubSection title="Disponibilidade">
              <p>
                A doula configura sua disponibilidade por data e faixa de horário. Os clientes podem
                solicitar agendamento nos horários disponíveis via portal.
              </p>
            </SubSection>
            <SubSection title="Solicitações de Agendamento">
              <p>
                Clientes podem solicitar consultas pelo portal. A doula recebe as solicitações pendentes
                na aba de agenda e pode aprovar, recusar ou reagendar.
              </p>
            </SubSection>
            <SubSection title="Lembretes Automáticos">
              <FeatureList items={[
                "Lembrete 24h antes da consulta via push notification",
                "Lembrete 1h antes da consulta via push notification",
                "Edge Function agendada (check-appointment-reminders) processa os lembretes",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 7. Financeiro */}
          <CollapsibleSection id="financeiro" title="Financeiro" icon={<Wallet className="h-5 w-5 text-primary" />}>
            <SubSection title="Receitas">
              <FeatureList items={[
                "Registro de transações de receita vinculadas a clientes",
                "Suporte a parcelamento com controle de parcelas individuais",
                "Métodos de pagamento: PIX, cartão, dinheiro, transferência, boleto",
                "Detalhamento de valores recebidos vs. valores totais",
                "Status automático: pendente, parcial, pago (sincronizado com o cliente)",
              ]} />
            </SubSection>
            <SubSection title="Despesas">
              <FeatureList items={[
                "Categorias: social media, filmmaker, marketing, material hospitalar, escritório, transporte, formação, equipamentos, serviços terceiros, outros",
                "Tipos: material de trabalho, serviços contratados",
                "Filtros por período e categoria",
              ]} />
            </SubSection>
            <SubSection title="Relatórios">
              <FeatureList items={[
                "Resumo financeiro por período",
                "Exportação em Excel (write-excel-file) e PDF (jsPDF)",
                "Gráficos de receita vs despesa (Recharts)",
                "Visão geral do faturamento no dashboard",
              ]} />
            </SubSection>
            <SubSection title="Configuração PIX">
              <p>
                A doula configura sua chave PIX (CPF/CNPJ, e-mail, telefone, aleatória) nas configurações.
                O sistema gera QR Code PIX (padrão EMV) para facilitar pagamentos dos clientes.
              </p>
            </SubSection>
          </CollapsibleSection>

          {/* 8. Mensagens */}
          <CollapsibleSection id="mensagens" title="Mensagens e Notificações" icon={<MessageCircle className="h-5 w-5 text-primary" />}>
            <SubSection title="Sistema de Mensagens">
              <FeatureList items={[
                "Chat bidirecional entre doula e cada cliente",
                "Suporte a anexos (imagens, documentos) via storage",
                "Contagem de mensagens não lidas com badges em tempo real",
                "Separação entre mensagens e notificações gerais",
              ]} />
            </SubSection>
            <SubSection title="Notificações">
              <FeatureList items={[
                "Notificações in-app com listener em tempo real (Supabase Realtime)",
                "Push notifications via Web Push (VAPID) e Firebase Cloud Messaging",
                "Notificações nativas via Capacitor para apps compilados",
                "Banner de notificação no topo da tela",
                "Centro de notificações com histórico completo",
              ]} />
            </SubSection>
            <SubSection title="Tipos de Notificação">
              <FeatureList items={[
                "Lembretes de consulta (24h e 1h antes)",
                "Vencimento de pagamento",
                "Nova mensagem da doula ou do cliente",
                "Solicitação de serviço",
                "Contrato disponível para assinatura",
                "Orçamento enviado",
                "Alerta de trabalho de parto",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 9. Portal da Gestante */}
          <CollapsibleSection id="portal-gestante" title="Portal da Gestante" icon={<Baby className="h-5 w-5 text-primary" />}>
            <SubSection title="Visão Geral">
              <p>
                Portal mobile-first exclusivo para clientes, acessado via <code>/gestante</code>.
                Layout dedicado com menu inferior e branding personalizado da doula.
              </p>
            </SubSection>
            <SubSection title="Funcionalidades">
              <FeatureList items={[
                "Dashboard com informações da gestação, semanas, DPP e próximas consultas",
                "Diário da gestação — registros diários com emoção, sintomas e observações",
                "Cronômetro de contrações — início/fim com cálculo de duração e intervalo",
                "Botão de trabalho de parto — alerta a doula em tempo real",
                "Consultas — visualização e solicitação de agendamento",
                "Serviços extras — solicitação de serviços com data preferida",
                "Mensagens — chat direto com a doula",
                "Documentos — contratos pendentes e assinados",
                "Perfil — dados pessoais, avatar, informações do acompanhante",
                "Comunidade — acesso ao fórum compartilhado",
              ]} />
            </SubSection>
            <SubSection title="Contrato Digital">
              <p>
                A doula cria contratos com conteúdo editável (editor rich text). O cliente recebe a
                notificação, visualiza o contrato e assina digitalmente com nome completo e IP registrado.
              </p>
            </SubSection>
            <SubSection title="Pagamentos">
              <FeatureList items={[
                "Visualização de parcelas pendentes e pagas",
                "QR Code PIX gerado automaticamente para pagamento",
                "Alerta de pagamento em atraso no topo do portal",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 10. Comunidade */}
          <CollapsibleSection id="comunidade" title="Comunidade (Fórum)" icon={<Users2 className="h-5 w-5 text-primary" />}>
            <SubSection title="Funcionalidades">
              <FeatureList items={[
                "Categorias configuráveis com ícones",
                "Posts com título, conteúdo e imagem opcional",
                "Comentários em posts",
                "Reações (curtidas) em posts e comentários",
                "Opção de post anônimo",
                "Posts fixados (pinned) pelo admin",
                "Moderação: ocultar posts e comentários",
                "Audiência: público (todos) ou restrito à organização",
                "Perfis com identificação de doulas (badge especial)",
                "Preview de links do Instagram integrado",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 11. Planos */}
          <CollapsibleSection id="planos" title="Planos e Limites da Plataforma" icon={<Star className="h-5 w-5 text-primary" />}>
            <SubSection title="Planos Disponíveis">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {[
                  { plan: "Free", features: "Funcionalidades básicas, limite de clientes" },
                  { plan: "Pro", features: "Mais clientes, push notifications, relatórios, exportação" },
                  { plan: "Premium", features: "Tudo liberado, múltiplos colaboradores, sem limites" },
                ].map((p) => (
                  <div key={p.plan} className="p-3 rounded-lg bg-muted/50 border border-border/30">
                    <Badge className="mb-1 text-xs">{p.plan}</Badge>
                    <p className="text-xs text-muted-foreground">{p.features}</p>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Limites Configuráveis">
              <FeatureList items={[
                "Máximo de clientes por plano",
                "Máximo de colaboradores",
                "Acesso a módulos: agenda, financeiro, despesas, relatórios, mensagens, notificações, push",
                "Exportação de relatórios",
                "Precificação por ciclo de cobrança (mensal, trimestral, anual)",
              ]} />
            </SubSection>
            <SubSection title="Promoções">
              <p>
                Sistema de promoções com suporte a trial period e bônus. Beta testers e parceiros
                podem receber planos premium vitalícios ou temporários.
              </p>
            </SubSection>
          </CollapsibleSection>

          {/* 12. Super Admin */}
          <CollapsibleSection id="super-admin" title="Super Admin" icon={<Shield className="h-5 w-5 text-primary" />}>
            <SubSection title="Dashboard Global">
              <FeatureList items={[
                "Métricas de crescimento: total de organizações, distribuição de planos",
                "Top organizações mais ativas (baseado em log de acesso)",
                "Contagem de clientes por organização",
                "Clientes online em tempo real (Supabase Presence)",
              ]} />
            </SubSection>
            <SubSection title="Gestão de Organizações">
              <FeatureList items={[
                "Aprovar novas doulas (status pendente → ativo)",
                "Alterar plano de uma organização (Free, Pro, Premium)",
                "Suspender ou reativar contas",
                "Excluir organizações (com cascade de dados)",
                "Gerenciar cobranças (org_billing) e notificações da plataforma",
              ]} />
            </SubSection>
            <SubSection title="Moderação de Conteúdo">
              <FeatureList items={[
                "Visualizar mensagens, notificações, diários, contratos e transações de qualquer organização",
                "Moderar posts e comentários do fórum",
                "Gerenciar categorias do fórum",
              ]} />
            </SubSection>
            <SubSection title="Gestão de Usuários">
              <FeatureList items={[
                "Listar todos os usuários do sistema",
                "Gerenciar papéis (admin, moderator, client, super_admin)",
                "Criar e remover usuários administradores",
                "Broadcast de notificações para todas as organizações",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 13. PWA */}
          <CollapsibleSection id="pwa" title="PWA e Push Notifications" icon={<Smartphone className="h-5 w-5 text-primary" />}>
            <SubSection title="Progressive Web App">
              <FeatureList items={[
                "Instalável em dispositivos móveis e desktop",
                "Service Worker com cache inteligente (Workbox)",
                "Atualização automática com prompt de nova versão",
                "Orientação retrato, display standalone",
                "Runtime caching para API do backend",
                "Versionamento automático com sufixo de build (DDMM.N)",
              ]} />
            </SubSection>
            <SubSection title="Push Notifications">
              <FeatureList items={[
                "Web Push via protocolo VAPID (chaves geradas por Edge Function)",
                "Suporte a Firebase Cloud Messaging como fallback",
                "Capacitor Push Notifications para apps nativos (iOS/Android)",
                "Prompt inteligente de permissão com modal explicativo",
                "Toggle de push por dispositivo",
                "Edge Function dedicada (send-push-notification) para envio server-side",
              ]} />
            </SubSection>
            <SubSection title="App Nativo (Capacitor)">
              <FeatureList items={[
                "Build para iOS e Android via Capacitor",
                "Status bar e navigation bar customizados",
                "Deep links e asset links configurados",
                "Force update listener para versões obrigatórias",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 14. Segurança */}
          <CollapsibleSection id="seguranca" title="Segurança" icon={<Lock className="h-5 w-5 text-primary" />}>
            <SubSection title="Autenticação">
              <FeatureList items={[
                "Autenticação via Supabase Auth com sessão persistente",
                "Refresh automático de tokens",
                "Verificação de e-mail obrigatória (sem auto-confirm)",
                "Recuperação de credenciais por e-mail",
                "Exclusão de conta pelo próprio usuário",
              ]} />
            </SubSection>
            <SubSection title="Autorização">
              <FeatureList items={[
                "Row Level Security (RLS) em todas as tabelas",
                "Função SECURITY DEFINER has_role() para verificação de papéis sem recursão",
                "Trigger para impedir alteração de organization_id",
                "Trigger para restringir campos editáveis por clientes",
                "Prevenção de papéis conflitantes (super_admin + admin)",
                "Isolamento completo entre organizações",
              ]} />
            </SubSection>
            <SubSection title="Edge Functions">
              <FeatureList items={[
                "Operações sensíveis (criação de usuários, exclusão) via Edge Functions server-side",
                "Chaves de serviço (service_role) nunca expostas ao client",
                "Validação de permissões no servidor para operações críticas",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* 15. Tecnologias */}
          <CollapsibleSection id="tecnologias" title="Stack Tecnológica" icon={<Zap className="h-5 w-5 text-primary" />}>
            <SubSection title="Frontend">
              <FeatureList items={[
                "React 18 com TypeScript 5",
                "Vite 5 como bundler",
                "Tailwind CSS v3 com design tokens semânticos",
                "shadcn/ui (Radix UI) para componentes",
                "React Router v6 para navegação",
                "TanStack Query (React Query) para cache e data fetching",
                "Recharts para gráficos",
                "Framer Motion / CSS animations",
                "date-fns para manipulação de datas",
                "jsPDF + jsPDF-AutoTable para geração de PDFs",
                "write-excel-file para exportação Excel",
                "qrcode.react para QR Codes PIX",
                "react-easy-crop para recorte de imagens",
                "react-hook-form + zod para formulários",
                "Lucide React para ícones",
              ]} />
            </SubSection>
            <SubSection title="Backend">
              <FeatureList items={[
                "Supabase (PostgreSQL) como banco de dados",
                "Supabase Auth para autenticação",
                "Supabase Realtime para dados em tempo real e presence",
                "Supabase Storage para arquivos e imagens",
                "Supabase Edge Functions (Deno) para lógica server-side",
                "Row Level Security (RLS) para isolamento de dados",
              ]} />
            </SubSection>
            <SubSection title="Edge Functions Disponíveis">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {[
                  "create-admin-user", "create-client-user", "delete-client-user",
                  "delete-organization", "register-doula", "manage-admin-user",
                  "provision-existing-clients", "resolve-client-login",
                  "recover-client-credentials", "reset-admin-password", "reset-client-password",
                  "send-push-notification", "get-vapid-public-key", "generate-vapid-keys",
                  "get-client-email", "check-appointment-reminders",
                  "check-payment-due-dates", "check-billing-overdue",
                  "cleanup-orphan-users", "generate-notification-text",
                  "generate-service-icon", "notify-forum-post",
                  "respond-budget", "request-account-deletion",
                ].map((fn) => (
                  <code key={fn} className="text-xs bg-muted px-2 py-1 rounded border border-border/30">{fn}</code>
                ))}
              </div>
            </SubSection>
            <SubSection title="Infraestrutura">
              <FeatureList items={[
                "Hospedagem: Lovable Cloud",
                "PWA com Service Worker (vite-plugin-pwa + Workbox)",
                "Capacitor para builds nativos iOS/Android",
                "Versionamento semântico: X.Y.Z.DDMM.N",
              ]} />
            </SubSection>
          </CollapsibleSection>

          {/* Footer */}
          <div className="text-center py-8 text-xs text-muted-foreground">
            <p>v1.2.2 • Desenvolvido com ❤️ para Doulas</p>
            <p className="mt-1">© 2025 Doula Care. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
