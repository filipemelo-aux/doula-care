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
  MapPin,
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
  { to: "/clientes", icon: Users, label: "Clientes", bottomNav: true },
  { to: "/agenda", icon: CalendarDays, label: "Agenda", bottomNav: true },
  {
    icon: Wallet,
    label: "Financeiro",
    subItems: [
      { to: "/financeiro", icon: TrendingUp, label: "Entradas" },
      { to: "/despesas", icon: TrendingDown, label: "Despesas" },
      { to: "/relatorios", icon: FileText, label: "Relatórios" },
    ],
  },
  { to: "/localizacao", icon: MapPin, label: "Localização e Atendimento", bottomNav: true },
  { to: "/comunidade", icon: Users2, label: "Comunidade" },
  { to: "/mensagens", icon: MessageCircle, label: "Mensagens", badgeKey: "messages" as const },
  { to: "/admin/assinatura", icon: Crown, label: "Assinatura" },
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
  const financialOpen = true;

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

  const isLifetime = promo?.status === "lifetime_active";
  const promoActive = promo && (promo.status === "trial_active" || promo.status === "lifetime_active");
  const promoEndDate = promo?.trial_ends_at ? new Date(promo.trial_ends_at) : null;
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
    if (onNavigate) {
      onNavigate();
    }
  };

  const planColors: Record<string, string> = {
    free: "text-muted-foreground",
    pro: "text-primary",
    premium: "text-amber-600",
  };

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
        {navItems.map((item) => {
          const hideOnMobile = 'bottomNav' in item && item.bottomNav;
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
              <div key={item.label} className="mt-2">
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
                  <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                  <span className={cn("transition-opacity flex-1 text-[13px]", !isOpen && "lg:hidden")}>
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform duration-300 ease-out",
                      financialOpen && "rotate-180",
                      !isOpen && "lg:hidden"
                    )}
                    strokeWidth={2}
                  />
                </button>

                {/* Submenu with accordion animation */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    financialOpen && isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="ml-5 mt-1 space-y-0.5 pl-3 border-l border-border/40">
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
                            "nav-link w-full text-left text-[13px] py-2.5",
                            subActive && "active",
                            subDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                          )}
                        >
                          <sub.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                          <span className="flex-1">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsed: sub-items as icons */}
                {!isOpen && (
                  <div className="hidden lg:flex flex-col items-center mt-1 space-y-0.5">
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
                          <sub.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
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
                isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                hideOnMobile && "hidden lg:flex"
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
          );
        })}
      </nav>

      {/* Footer — info card style */}
      <div className={cn("p-4", !isOpen && "lg:hidden")}>
        <div className="rounded-xl bg-muted/40 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-xs font-medium", planColors[plan] || "text-muted-foreground")}>
              {planLabel}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            {plan === "free" ? "Limite de 5 gestantes" : plan === "pro" ? "Gestantes ilimitadas" : "Recursos avançados"}
          </p>
          {promoActive && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                {isLifetime ? (
                  <>
                    <Crown className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-amber-600/80">Premium Vitalício</span>
                  </>
                ) : (
                  <>
                    <Gift className="h-3 w-3 text-primary/60" />
                    <span className="text-[10px] font-medium text-primary/70">Trial Premium</span>
                  </>
                )}
              </div>
              {!isLifetime && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {promoDaysLeft} dia{promoDaysLeft !== 1 ? "s" : ""} restante{promoDaysLeft !== 1 ? "s" : ""}
                </p>
              )}
              {isLifetime && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Acesso sem limite de tempo</p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
