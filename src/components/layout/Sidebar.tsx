import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Settings,
  ChevronLeft,
  ChevronDown,
  CalendarDays,
  Bell,
  Users2,
  MessageCircle,
  Gift,
  Sparkles,
  Crown,
  Wallet,
  MapPin,
  AlertCircle,
  Briefcase,
  Palette,
  HeartHandshake,
  ClipboardList,
  CalendarClock,
  CheckCircle,
  FolderOpen,
  UserPlus,
  Stethoscope,
  Baby,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useHideFreePlan } from "@/hooks/useHideFreePlan";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/notificacoes", icon: Bell, label: "Notificações", badgeKey: "notifications" as const },
  { to: "/clientes", icon: Users, label: "Clientes", bottomNav: true },
  { to: "/agenda", icon: CalendarDays, label: "Agenda", bottomNav: true },
  {
    icon: HeartHandshake,
    label: "Serviços",
    subItems: [
      { to: "/servicos/acompanhamentos", icon: Baby, label: "Acompanhamentos" },
      { to: "/servicos/atendimentos", icon: ClipboardList, label: "Atendimentos" },
      { to: "/servicos/previsoes", icon: CalendarClock, label: "Previsões de Recebimento" },
    ],
  },
  {
    icon: Wallet,
    label: "Financeiro",
    subItems: [
      { to: "/financeiro", icon: TrendingUp, label: "Faturas e Contas a Receber" },
      { to: "/despesas", icon: TrendingDown, label: "Contas a Pagar" },
      { to: "/contas-pagas", icon: CheckCircle, label: "Contas Pagas" },
      { to: "/cobrancas", icon: AlertCircle, label: "Cobranças" },
      { to: "/relatorios", icon: FileText, label: "Relatórios" },
    ],
  },
  {
    icon: FolderOpen,
    label: "Cadastros",
    subItems: [
      { to: "/cadastros/pessoas", icon: UserPlus, label: "Pessoas" },
      { to: "/cadastros/servicos", icon: Stethoscope, label: "Serviços" },
    ],
  },

  {
    icon: Briefcase,
    label: "Meu Negócio",
    subItems: [
      { to: "/minha-marca", icon: Palette, label: "Minha Marca" },
      { to: "/localizacao", icon: MapPin, label: "Localização e Atendimento" },
    ],
  },

  // { to: "/comunidade", icon: Users2, label: "Comunidade" }, // Oculto — acessível apenas via URL direta
];

const subscriptionNavItem = { to: "/admin/assinatura", icon: Crown, label: "Assinatura" };
const settingsNavItem = { to: "/configuracoes", icon: Settings, label: "Configurações" };

export function Sidebar({ isOpen, onToggle, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { planLabel, plan, limits } = usePlanLimits();
  const { logoUrl: orgLogo, displayName } = useOrgBranding();
  const { unreadMessages, unreadNotifications } = useAdminUnreadCounts();
  const { organizationId, role } = useAuth();
  const hideFreePlan = useHideFreePlan();
  const isModerator = role === "moderator";

  // Moderadores não têm acesso ao módulo Financeiro (entradas, despesas, cobranças e relatórios)
  const visibleNavItems = navItems.filter((item) => {
    if (isModerator && "subItems" in item && (item.label === "Financeiro" || item.label === "Serviços" || item.label === "Cadastros")) return false;
    return true;
  });


  const isFinancialRoute = ["/financeiro", "/despesas", "/contas-pagas", "/cobrancas", "/relatorios"].includes(location.pathname);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("sidebar-open-groups") || "{}"); } catch { return {}; }
  });
  const toggleGroup = (label: string, current: boolean) => {
    const next = { ...openGroups, [label]: !current };
    setOpenGroups(next);
    localStorage.setItem("sidebar-open-groups", JSON.stringify(next));
  };

  useEffect(() => {
    if (isOpen) return;
    setOpenGroups({});
    localStorage.setItem("sidebar-open-groups", "{}");
  }, [isOpen]);


  const { data: promo } = useQuery({
    queryKey: ["my-org-promo", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["trial_active", "lifetime_active"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });


  const getBadgeCount = (key?: "notifications" | "messages") => {
    if (key === "notifications") return unreadNotifications;
    if (key === "messages") return unreadMessages;
    return 0;
  };
  const sidebarLogo = orgLogo || logo;
  const sidebarName = displayName || "Doula Care";

  const handleNavClick = (to: string) => {
    navigate(to);
    if (onNavigate) {
      onNavigate();
    }
  };

  const planColors: Record<string, string> = {
    free: "text-muted-foreground",
    pro: "text-primary",
    premium: "text-amber-600",
  };

  // Oculta o card do plano quando o Super Admin escondeu o plano Free
  const hidePlanCard = hideFreePlan && plan === "free";

  const planDescription = (() => {
    if (limits.maxClients === null) return "Gestantes ilimitadas";
    return `Limite de ${limits.maxClients} ${limits.maxClients === 1 ? "gestante" : "gestantes"}`;
  })();

  return (
    <aside
      className={cn(
        "fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]",
        "bg-[hsl(var(--background))] shadow-[1px_0_12px_-4px_hsl(var(--foreground)/0.08)]",
        isOpen ? "w-64" : "w-0 lg:w-20",
        !isOpen && "invisible lg:visible"
      )}
    >
      {/* Logo - mobile only */}
      {isOpen && (
        <div className="lg:hidden h-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={sidebarLogo} alt={sidebarName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <div>
              <h1 className="font-display text-lg text-foreground">{sidebarName}</h1>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Dashboard</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNavItems.map((item) => {
          const hideOnMobile = 'bottomNav' in item && item.bottomNav;
          // Submenu item (Financeiro)
          if ("subItems" in item && item.subItems) {
            const subLimitKeys: Record<string, keyof typeof limits> = {
              "/financeiro": "financial",
              "/despesas": "expenses",
               "/contas-pagas": "expenses",
              "/cobrancas": "financial",
              "/relatorios": "reports",
              "/servicos/atendimentos": "financial",
              "/servicos/previsoes": "financial",
            };

            const allDisabled = item.subItems.every((s) => {
              const lk = subLimitKeys[s.to];
              return lk ? !limits[lk] : false;
            });
            const isSubActive = item.subItems.some((s) => location.pathname === s.to);
            const groupOpen = openGroups[item.label] ?? isSubActive;

            return (
              <div key={item.label} className="mt-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label, groupOpen)}
                  aria-expanded={groupOpen}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-foreground transition-colors",
                    !isOpen && "lg:hidden"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !groupOpen && "-rotate-90")} />
                </button>

                <div className={cn("space-y-0.5", (!groupOpen || !isOpen) && "hidden")}>
                  {item.subItems.map((sub) => {
                    const lk = subLimitKeys[sub.to];
                    const subDisabled = lk ? !limits[lk] : false;
                    const subActive = !subDisabled && location.pathname === sub.to;
                    return (
                      <button
                        key={sub.to}
                        onClick={() => !subDisabled && handleNavClick(sub.to)}
                        disabled={subDisabled}
                        className={cn(
                          "nav-link w-full text-left",
                          subActive && "active",
                          !isOpen && "lg:justify-center lg:px-0",
                          subDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                        )}
                        title={!isOpen ? sub.label : undefined}
                      >
                        <sub.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                        <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
                          {sub.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Regular item
          const routeToLimit: Record<string, keyof typeof limits> = {
            "/relatorios": "reports",
            "/agenda": "agenda",
            "/clientes": "clients",
            "/notificacoes": "notifications",
            "/mensagens": "messages",
          };
          const limitKey = routeToLimit[item.to!];
          const isDisabled = limitKey ? !limits[limitKey] : false;
          const isActive = !isDisabled && location.pathname === item.to;
          const badgeCount = isDisabled ? 0 : getBadgeCount((item as any).badgeKey);
          // Browser access stays enabled at every screen size; only native apps retain text-only navigation.
          const isMobileTextOnly = (item as any).mobileTextOnly && Capacitor.isNativePlatform();

          return (
            <div key={item.to} className={cn(hideOnMobile && "hidden lg:flex")}>
              {/* Desktop: normal link */}
              <button
                onClick={() => !isDisabled && handleNavClick(item.to!)}
                disabled={isDisabled}
                className={cn(
                  "nav-link w-full text-left relative",
                  isMobileTextOnly && "hidden lg:flex",
                  isActive && "active",
                  !isOpen && "lg:justify-center lg:px-0",
                  isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                )}
                title={!isOpen ? item.label : isDisabled ? "Recurso indisponível no seu plano" : undefined}
              >
                <div className="relative">
                  <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                  {badgeCount > 0 && !isOpen && (
                    <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-destructive hidden lg:block" />
                  )}
                </div>
                <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
                  {item.label}
                </span>
                {badgeCount > 0 && isOpen && (
                  <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center ml-auto">
                    {badgeCount}
                  </Badge>
                )}
              </button>

              {/* Mobile: text-only (no link) */}
              {isMobileTextOnly && (
                <div
                  className={cn(
                    "nav-link w-full text-left relative opacity-60 cursor-default lg:hidden",
                    !isOpen && "lg:hidden"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                  <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
                    {item.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Assinatura + Configurações — fixados no rodapé, divididos por um separador */}
      <div className="px-3 pt-2 pb-1">
        <button
          onClick={() => handleNavClick(subscriptionNavItem.to)}
          className={cn(
            "nav-link w-full text-left",
            !Capacitor.isNativePlatform() && location.pathname === subscriptionNavItem.to && "active",
            !isOpen && "lg:justify-center lg:px-0"
          )}
          title={!isOpen ? subscriptionNavItem.label : undefined}
        >
          <subscriptionNavItem.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
          <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
            {subscriptionNavItem.label}
          </span>
        </button>

        <div className="my-1.5 border-t border-border/40" />

        <button
          onClick={() => handleNavClick(settingsNavItem.to)}
          className={cn(
            "nav-link w-full text-left",
            location.pathname === settingsNavItem.to && "active",
            !isOpen && "lg:justify-center lg:px-0"
          )}
          title={!isOpen ? settingsNavItem.label : undefined}
        >
          <settingsNavItem.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
          <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
            {settingsNavItem.label}
          </span>
        </button>
      </div>

      {/* Footer — info card style */}
      {!hidePlanCard && (
        <div className={cn("px-4 pb-4 pt-2", !isOpen && "lg:hidden")}>
          <div className="rounded-xl bg-muted/40 p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-medium", planColors[plan] || "text-muted-foreground")}>
                {planLabel}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              {planDescription}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
