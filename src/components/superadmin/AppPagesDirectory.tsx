import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface PageEntry {
  path: string;
  label: string;
  description?: string;
}

interface PageGroup {
  title: string;
  description: string;
  pages: PageEntry[];
}

const groups: PageGroup[] = [
  {
    title: "Públicas",
    description: "Acessíveis sem login",
    pages: [
      { path: "/login", label: "Login" },
      { path: "/cadastro", label: "Cadastro de Doula" },
      { path: "/cadastro-visitante", label: "Cadastro de Visitante" },
      { path: "/recuperar-acesso", label: "Recuperar Acesso" },
      { path: "/politica-de-privacidade", label: "Política de Privacidade" },
      { path: "/excluir-conta", label: "Excluir Conta" },
      { path: "/documentacao", label: "Documentação" },
      { path: "/suporte", label: "Suporte" },
      { path: "/marketing", label: "Marketing" },
      { path: "/portal", label: "Portal" },
    ],
  },
  {
    title: "Visitante",
    description: "Área pública da gestante visitante",
    pages: [
      { path: "/visitante", label: "Dashboard Visitante" },
      { path: "/visitante/buscar", label: "Buscar Doulas" },
      { path: "/visitante/diario", label: "Diário (Visitante)" },
      { path: "/visitante/contracoes", label: "Contrações (Visitante)" },
      { path: "/visitante/perfil", label: "Perfil (Visitante)" },
      { path: "/visitante/gestacao/semana/12", label: "Semana da Gestação (exemplo: 12)" },
    ],
  },
  {
    title: "Admin (Doula)",
    description: "Requer login como admin/moderator",
    pages: [
      { path: "/admin", label: "Dashboard" },
      { path: "/notificacoes", label: "Notificações" },
      { path: "/mensagens", label: "Mensagens" },
      { path: "/agenda", label: "Agenda" },
      { path: "/clientes", label: "Clientes" },
      { path: "/financeiro", label: "Financeiro" },
      { path: "/despesas", label: "Despesas" },
      { path: "/relatorios", label: "Relatórios" },
      { path: "/comunidade", label: "Comunidade (Papo de Doula)" },
      { path: "/configuracoes", label: "Configurações" },
      { path: "/localizacao", label: "Localização e Cobertura" },
      { path: "/admin/assinatura", label: "Assinatura" },
    ],
  },
  {
    title: "Gestante (Cliente)",
    description: "Requer login como cliente",
    pages: [
      { path: "/gestante", label: "Dashboard Gestante" },
      { path: "/gestante/diario", label: "Diário" },
      { path: "/gestante/mensagens", label: "Mensagens" },
      { path: "/gestante/contracoes", label: "Contrações" },
      { path: "/gestante/amamentacao", label: "Amamentação" },
      { path: "/gestante/servicos", label: "Serviços" },
      { path: "/gestante/consultas", label: "Consultas" },
      { path: "/gestante/documentos", label: "Documentos" },
      { path: "/gestante/comunidade", label: "Comunidade" },
      { path: "/gestante/perfil", label: "Perfil" },
      { path: "/gestante/alterar-senha", label: "Alterar Senha" },
    ],
  },
  {
    title: "Super Admin",
    description: "Área restrita",
    pages: [
      { path: "/super-admin", label: "Painel Super Admin" },
    ],
  },
];

export function AppPagesDirectory() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Mapa de Páginas</h2>
        <p className="text-sm text-muted-foreground">
          Acesso direto a todas as rotas do aplicativo. Algumas exigem o papel apropriado para serem renderizadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{group.title}</CardTitle>
              <CardDescription className="text-xs">{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {group.pages.map((page) => (
                <Link
                  key={page.path}
                  to={page.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{page.label}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{page.path}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
