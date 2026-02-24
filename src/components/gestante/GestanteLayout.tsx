import { useState } from "react";
import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useNavigate, useLocation } from "react-router-dom";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { 
  LayoutDashboard,
  BookHeart, 
  MessageCircle, 
  Baby, 
  Timer, 
  User,
  LogOut,
  Menu,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PushNotificationToggle } from "@/components/pwa/PushNotificationToggle";

interface GestanteLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/gestante", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/gestante/diario", icon: BookHeart, label: "Diário" },
  { to: "/gestante/mensagens", icon: MessageCircle, label: "Mensagens" },
  { to: "/gestante/contracoes", icon: Timer, label: "Contrações" },
  { to: "/gestante/perfil", icon: User, label: "Perfil" },
];

export function GestanteLayout({ children }: GestanteLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useGestanteAuth();
  const { logoUrl: orgLogo, displayName } = useOrgBranding();
  const headerLogo = orgLogo || logo;
  const headerName = displayName || "Doula Care";

  const handleNavClick = (to: string) => {
    navigate(to);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-64" : "w-0 lg:w-20",
          !sidebarOpen && "overflow-hidden lg:overflow-visible"
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-3 transition-opacity", !sidebarOpen && "lg:opacity-0")}>
            <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <div>
              <h1 className="font-display text-lg text-sidebar-foreground">{headerName}</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "hidden lg:flex h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              !sidebarOpen && "absolute right-2 top-6"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Collapsed Logo */}
        {!sidebarOpen && (
          <div className="hidden lg:flex h-20 absolute top-0 left-0 w-20 items-center justify-between px-2">
            <div className="w-8 h-8 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
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
                  !sidebarOpen && "lg:justify-center lg:px-0"
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-current")} />
                <span className={cn("transition-opacity flex-1", !sidebarOpen && "lg:hidden")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Logout in sidebar */}
        <div className={cn("p-4 border-t border-sidebar-border", !sidebarOpen && "lg:hidden")}>
          <button
            onClick={signOut}
            className="nav-link w-full text-left text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="flex-1">Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mr-4"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/gestante")}>
              <div className="w-8 h-8 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
                <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
              </div>
              <h1 className="font-display text-lg text-foreground">{headerName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PushNotificationToggle compact />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 border-b border-border items-center justify-between px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
              <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
            </div>
            <h1 className="font-display text-lg text-foreground">{headerName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <PushNotificationToggle compact />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto w-full box-border">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
