import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Settings,
  ChevronLeft,
  CalendarDays,
  Bell,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/notificacoes", icon: Bell, label: "Notificações", badgeKey: "notifications" as const },
  { to: "/mensagens", icon: MessageCircle, label: "Mensagens", badgeKey: "messages" as const },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/financeiro", icon: TrendingUp, label: "Financeiro" },
  { to: "/despesas", icon: TrendingDown, label: "Despesas" },
  { to: "/relatorios", icon: FileText, label: "Relatórios" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export function Sidebar({ isOpen, onToggle, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { planLabel, plan, limits } = usePlanLimits();
  const { logoUrl: orgLogo, displayName } = useOrgBranding();
  const { unreadMessages, unreadNotifications } = useAdminUnreadCounts();

  const getBadgeCount = (key?: "notifications" | "messages") => {
    if (key === "notifications") return unreadNotifications;
    if (key === "messages") return unreadMessages;
    return 0;
  };
  const sidebarLogo = orgLogo || logo;
  const sidebarName = displayName || "Doula Care";

  const handleNavClick = (to: string) => {
    navigate(to);
    // Collapse sidebar on mobile after navigation
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0 lg:w-20",
        !isOpen && "overflow-hidden lg:overflow-visible"
      )}
    >
      {/* Logo - mobile only */}
      <div className="lg:hidden h-20 flex items-center justify-between px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
            <img src={sidebarLogo} alt={sidebarName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
          </div>
          <div>
            <h1 className="font-display text-lg text-sidebar-foreground">{sidebarName}</h1>
            <p className="text-xs text-sidebar-foreground/60">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const routeToLimit: Record<string, keyof typeof limits> = {
            "/relatorios": "reports",
            "/agenda": "agenda",
            "/clientes": "clients",
            "/financeiro": "financial",
            "/despesas": "expenses",
            "/notificacoes": "notifications",
            "/mensagens": "messages",
          };
          const limitKey = routeToLimit[item.to];
          const isDisabled = limitKey ? !limits[limitKey] : false;
          const isActive = !isDisabled && location.pathname === item.to;
          const badgeCount = isDisabled ? 0 : getBadgeCount((item as any).badgeKey);
          return (
            <button
              key={item.to}
              onClick={() => !isDisabled && handleNavClick(item.to)}
              disabled={isDisabled}
              className={cn(
                "nav-link w-full text-left relative",
                isActive && "active",
                !isOpen && "lg:justify-center lg:px-0",
                isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
              title={!isOpen ? item.label : isDisabled ? "Recurso indisponível no seu plano" : undefined}
            >
              <div className="relative">
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-current")} />
                {badgeCount > 0 && !isOpen && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive hidden lg:block" />
                )}
              </div>
              <span className={cn("transition-opacity flex-1", !isOpen && "lg:hidden")}>
                {item.label}
              </span>
              {badgeCount > 0 && isOpen && (
                <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center ml-auto">
                  {badgeCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("p-4 border-t border-sidebar-border", !isOpen && "lg:hidden")}>
        <div className="bg-sidebar-accent rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-sidebar-accent-foreground font-medium">
              Plano atual
            </p>
            <Badge variant={plan === "free" ? "secondary" : plan === "pro" ? "default" : "outline"} className="uppercase text-[10px]">
              {planLabel}
            </Badge>
          </div>
          <p className="text-xs text-sidebar-foreground/60">
            {plan === "free" ? "Limite de 5 gestantes" : plan === "pro" ? "Gestantes ilimitadas" : "Recursos avançados"}
          </p>
        </div>
      </div>
    </aside>
  );
}
