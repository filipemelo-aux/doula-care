import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays } from "date-fns";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/notificacoes", icon: Bell, label: "Notificações", badgeKey: "notifications" as const },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  {
    icon: Wallet,
    label: "Financeiro",
    subItems: [
      { to: "/financeiro", icon: TrendingUp, label: "Receitas" },
      { to: "/despesas", icon: TrendingDown, label: "Despesas" },
      { to: "/relatorios", icon: FileText, label: "Relatórios" },
    ],
  },
  { to: "/mensagens", icon: MessageCircle, label: "Mensagens", badgeKey: "messages" as const },
  { to: "/comunidade", icon: Users2, label: "Comunidade" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export function Sidebar({ isOpen, onToggle, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { planLabel, plan, limits } = usePlanLimits();
  const { logoUrl: orgLogo, displayName } = useOrgBranding();
  const { unreadMessages, unreadNotifications } = useAdminUnreadCounts();
  const { organizationId } = useAuth();

  const isFinancialRoute = ["/financeiro", "/despesas", "/relatorios"].includes(location.pathname);
  const [financialOpen, setFinancialOpen] = useState(isFinancialRoute);

  const { data: promo } = useQuery({
    queryKey: ["my-org-promo", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("org_promotions" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .in("promotion_type", ["beta_tester", "lifetime_premium"])
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const isLifetime = promo?.promotion_type === "lifetime_premium";
  const promoActive = promo && (promo.status === "trial_active" || promo.status === "bonus_active" || promo.status === "lifetime_active");
  const promoTrialEnds = promo?.trial_ends_at ? new Date(promo.trial_ends_at) : null;
  const promoBonusEnds = promo?.bonus_ends_at ? new Date(promo.bonus_ends_at) : null;
  const promoEndDate = promo?.status === "bonus_active" ? promoBonusEnds : promoTrialEnds;
  const promoDaysLeft = promoEndDate ? Math.max(0, differenceInDays(promoEndDate, new Date())) : 0;

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
        "fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 ease-in-out pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]",
        isOpen ? "w-64" : "w-0 lg:w-20"
      )}
    >
      {/* On mobile, fully unmount sidebar contents when closed to avoid iOS WKWebView overflow issues */}
      {!isOpen && <div className="contents hidden lg:contents" />}
      {(isOpen || typeof window !== "undefined") && (
      {/* Logo - mobile only (hidden when sidebar collapsed) */}
      {isOpen && (
        <div className="lg:hidden h-20 flex items-center justify-between px-6">
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
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Submenu item (Financeiro)
          if ("subItems" in item && item.subItems) {
            const subLimitKeys: Record<string, keyof typeof limits> = {
              "/financeiro": "financial",
              "/despesas": "expenses",
              "/relatorios": "reports",
            };
            const allDisabled = item.subItems.every((s) => {
              const lk = subLimitKeys[s.to];
              return lk ? !limits[lk] : false;
            });
            const isSubActive = item.subItems.some((s) => location.pathname === s.to);

            return (
              <div key={item.label}>
                <button
                  onClick={() => setFinancialOpen((v) => !v)}
                  disabled={allDisabled}
                  className={cn(
                    "nav-link w-full text-left relative",
                    isSubActive && "active",
                    !isOpen && "lg:justify-center lg:px-0",
                    allDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                  )}
                  title={!isOpen ? item.label : allDisabled ? "Recurso indisponível no seu plano" : undefined}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0", isSubActive && "text-current")} />
                  <span className={cn("transition-opacity flex-1", !isOpen && "lg:hidden")}>
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      financialOpen && "rotate-180",
                      !isOpen && "lg:hidden"
                    )}
                  />
                </button>
                {financialOpen && isOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 pl-2">
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
                            "nav-link w-full text-left text-sm py-2",
                            subActive && "active",
                            subDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                          )}
                        >
                          <sub.icon className={cn("w-4 h-4 shrink-0", subActive && "text-current")} />
                          <span className="flex-1">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Collapsed: show sub-items as individual icons */}
                {!isOpen && (
                  <div className="hidden lg:flex flex-col items-center mt-1 space-y-1">
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
                            "nav-link justify-center px-0 w-full",
                            subActive && "active",
                            subDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                          )}
                          title={sub.label}
                        >
                          <sub.icon className={cn("w-4 h-4 shrink-0", subActive && "text-current")} />
                        </button>
                      );
                    })}
                  </div>
                )}
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
          return (
            <button
              key={item.to}
              onClick={() => !isDisabled && handleNavClick(item.to!)}
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
      <div className={cn("p-4", !isOpen && "lg:hidden")}>
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
          {promoActive && (
            <div className="mt-2 pt-2/50">
              <div className="flex items-center gap-1.5 text-primary">
                {isLifetime && promo.status === "lifetime_active" ? (
                  <>
                    <Crown className="h-3 w-3 text-amber-500" />
                    <span className="text-[11px] font-medium text-amber-600">Premium Vitalício</span>
                  </>
                ) : (
                  <>
                    <Gift className="h-3 w-3" />
                    <span className="text-[11px] font-medium">
                      {promo.status === "trial_active" ? "Trial Beta" : promo.bonus_choice === "extra_30_days" ? "Bônus +30 dias" : "50% desconto anual"}
                    </span>
                  </>
                )}
              </div>
              {promo.status !== "lifetime_active" && (
                <p className="text-[10px] text-sidebar-foreground/60 mt-0.5">
                  {promoDaysLeft} dia{promoDaysLeft !== 1 ? "s" : ""} restante{promoDaysLeft !== 1 ? "s" : ""}
                </p>
              )}
              {promo.status === "lifetime_active" && (
                <p className="text-[10px] text-sidebar-foreground/60 mt-0.5">Acesso sem limite de tempo</p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
