import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  TrendingUp,
  TrendingDown,
  FileText,
  Settings,
  Heart,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/planos", icon: CreditCard, label: "Planos" },
  { to: "/financeiro", icon: TrendingUp, label: "Financeiro" },
  { to: "/despesas", icon: TrendingDown, label: "Despesas" },
  { to: "/relatorios", icon: FileText, label: "Relatórios" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export function Sidebar({ isOpen, onToggle, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

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
        "fixed lg:relative inset-y-0 left-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0 lg:w-20",
        !isOpen && "overflow-hidden lg:overflow-visible"
      )}
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3 transition-opacity", !isOpen && "lg:opacity-0")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl text-sidebar-foreground">Doula Care</h1>
            <p className="text-xs text-sidebar-foreground/60">Dashboard</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "hidden lg:flex h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            !isOpen && "absolute right-2 top-6"
          )}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")} />
        </Button>
      </div>

      {/* Collapsed Logo and Expand Button */}
      {!isOpen && (
        <div className="hidden lg:flex h-20 absolute top-0 left-0 w-20 items-center justify-between px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <button
              key={item.to}
              onClick={() => handleNavClick(item.to)}
              className={cn(
                "nav-link w-full text-left",
                isActive && "active",
                !isOpen && "lg:justify-center lg:px-0"
              )}
              title={!isOpen ? item.label : undefined}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-current")} />
              <span className={cn("transition-opacity", !isOpen && "lg:hidden")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("p-4 border-t border-sidebar-border", !isOpen && "lg:hidden")}>
        <div className="bg-sidebar-accent rounded-lg p-4">
          <p className="text-sm text-sidebar-accent-foreground font-medium mb-1">
            Precisa de ajuda?
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            Acesse nosso suporte para tirar suas dúvidas
          </p>
        </div>
      </div>
    </aside>
  );
}
