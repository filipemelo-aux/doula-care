import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PermissionGroup {
  label: string;
  items: { to: string; label: string }[];
}

/** Menus e submenus que a doula pode liberar para membros da equipe. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: "Principal", items: [
    { to: "/notificacoes", label: "Notificações" },
    { to: "/clientes", label: "Clientes" },
    { to: "/agenda", label: "Agenda" },
    { to: "/mensagens", label: "Mensagens" },
  ] },
  { label: "Serviços", items: [
    { to: "/servicos/acompanhamentos", label: "Acompanhamentos" },
    { to: "/servicos/atendimentos", label: "Atendimentos" },
  ] },
  { label: "Financeiro", items: [
    { to: "/financeiro", label: "Contas a Receber" },
    { to: "/despesas", label: "Contas a Pagar" },
    { to: "/contas-pagas", label: "Contas Pagas" },
    { to: "/cobrancas", label: "Cobranças" },
    { to: "/relatorios", label: "Relatórios" },
  ] },
  { label: "Cadastros", items: [
    { to: "/cadastros/servicos", label: "Serviços" },
    { to: "/cadastros/usuarios", label: "Usuários" },
  ] },
  { label: "Meu Negócio", items: [
    { to: "/minha-marca", label: "Minha Marca" },
    { to: "/meus-planos", label: "Meus planos" },
    { to: "/localizacao", label: "Localização e Atendimento" },
  ] },
  { label: "Conta", items: [
    { to: "/admin/assinatura", label: "Assinatura" },
  ] },
];

/** Usado quando a doula ainda não configurou os acessos da membro. */
export const DEFAULT_TEAM_PATHS = ["/notificacoes", "/clientes", "/agenda", "/mensagens"];

/** Sempre liberados: Visão Geral e Configurações (troca da própria senha). */
export const ALWAYS_ALLOWED = ["/admin", "/configuracoes", "/admin/alterar-senha", "/comunidade"];

/** Retorna null quando não há restrição (doula), ou a lista de caminhos liberados. */
export function useTeamPermissions() {
  const { user, role, roles, roleChecked } = useAuth() as any;
  // Membro da equipe: tem papel moderator sem ser admin/super_admin
  const roleList: string[] = Array.isArray(roles) ? roles : [];
  const isModerator = role === "moderator" || (roleList.includes("moderator") && !roleList.includes("admin") && !roleList.includes("super_admin"));
  // Enquanto o papel ainda não foi carregado, nada além do básico é liberado
  const roleUnknown = !!user && (!roleChecked || !role);
  const { data, isLoading } = useQuery({
    queryKey: ["team-permissions", user?.id],
    enabled: isModerator && !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await (supabase.from("team_member_permissions" as any) as any)
        .select("allowed_paths").eq("user_id", user!.id).maybeSingle();
      return (data?.allowed_paths as string[] | undefined) ?? DEFAULT_TEAM_PATHS;
    },
  });
  if (roleUnknown) return { allowed: [] as string[] | null, isLoading: true, can: (path: string) => ALWAYS_ALLOWED.includes(path) };
  if (!isModerator) return { allowed: null as string[] | null, isLoading: false, can: (_: string) => true };
  const allowed = data ?? null;
  const can = (path: string) => ALWAYS_ALLOWED.includes(path) || !!allowed?.includes(path);
  return { allowed, isLoading: isLoading || !data, can };
}
