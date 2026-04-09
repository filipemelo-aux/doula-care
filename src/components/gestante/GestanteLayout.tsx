import { useState, useEffect } from "react";
import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useNavigate, useLocation } from "react-router-dom";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { useGestanteUnreadCount } from "@/hooks/useGestanteUnreadCount";
import { useGestanteMenuBadges } from "@/hooks/useGestanteMenuBadges";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard,
  BookHeart, 
  MessageCircle, 
  Baby, 
  Timer, 
  User,
  LogOut,
  Menu,
  ChevronLeft,
  Briefcase,
  FileText,
  Users2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PushNotificationToggle } from "@/components/pwa/PushNotificationToggle";
import { useClientPresenceBroadcast } from "@/hooks/useClientPresence";

interface GestanteLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/gestante", icon: LayoutDashboard, label: "Visão Geral" },
  { to: "/gestante/contracoes", icon: Timer, label: "Contrações" },
  { to: "/gestante/consultas", icon: Baby, label: "Consultas" },
  { to: "/gestante/servicos", icon: Briefcase, label: "Serviços" },
  { to: "/gestante/documentos", icon: FileText, label: "Documentos" },
  { to: "/gestante/mensagens", icon: MessageCircle, label: "Mensagens" },
  { to: "/gestante/diario", icon: BookHeart, label: "Diário" },
  { to: "/gestante/comunidade", icon: Users2, label: "Comunidade" },
  { to: "/gestante/perfil", icon: User, label: "Perfil" },
];

// Module-level flag: true after the first mount so SPA navigations don't redirect
let gestanteLayoutMounted = false;

export function GestanteLayout({ children }: GestanteLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, client, user } = useGestanteAuth();
  const { logoUrl: orgLogo, displayName } = useOrgBranding();
  const unreadMessages = useGestanteUnreadCount(client?.id);
  const menuBadges = useGestanteMenuBadges(client?.id, user?.id, location.pathname);
  useClientPresenceBroadcast();
  const headerLogo = orgLogo || logo;
  const headerName = displayName || "Doula Care";

  useEffect(() => {
    if (gestanteLayoutMounted) return;
    gestanteLayoutMounted = true;

    const isSubPage = location.pathname !== "/gestante" && location.pathname.startsWith("/gestante/");
    const fromNotification = new URLSearchParams(location.search).get("from_notification");

    if (isSubPage && !fromNotification) {
      navigate("/gestante", { replace: true });
    }

    if (fromNotification) {
      const params = new URLSearchParams(location.search);
      params.delete("from_notification");
      const cleanSearch = params.toString();
      const cleanUrl = location.pathname + (cleanSearch ? `?${cleanSearch}` : "");
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  const handleNavClick = (to: string) => {
    navigate(to);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell h-[100dvh] flex w-full bg-background overflow-hidden">
      {/* Sidebar — matches admin Sidebar styling */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]",
          "bg-[hsl(var(--background))] shadow-[1px_0_12px_-4px_hsl(var(--foreground)/0.08)]",
          sidebarOpen ? "w-64" : "w-0 lg:w-20",
          !sidebarOpen && "invisible lg:visible"
        )}
      >
        {/* Logo — mobile only (when open) */}
        {sidebarOpen && (
          <div className="lg:hidden h-20 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
                <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
              </div>
              <div>
                <h1 className="font-display text-lg text-foreground">{headerName}</h1>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Portal</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const badgeCount = 
              item.to === "/gestante/mensagens" ? menuBadges.mensagens :
              item.to === "/gestante/consultas" ? menuBadges.consultas :
              item.to === "/gestante/servicos" ? menuBadges.servicos :
              0;
            return (
              <button
                key={item.to}
                onClick={() => handleNavClick(item.to)}
                className={cn(
                  "nav-link w-full text-left relative",
                  isActive && "active",
                  !sidebarOpen && "lg:justify-center lg:px-0"
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <div className="relative">
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-current")} strokeWidth={1.8} />
                  {badgeCount > 0 && !sidebarOpen && (
                    <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-destructive hidden lg:block" />
                  )}
                </div>
                <span className={cn("transition-opacity flex-1 text-[13px]", !sidebarOpen && "lg:hidden")}>
                  {item.label}
                </span>
                {badgeCount > 0 && sidebarOpen && (
                  <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center ml-auto">
                    {badgeCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout in sidebar */}
        <div className={cn("p-4", !sidebarOpen && "lg:hidden")}>
          <button
            onClick={signOut}
            className="nav-link w-full text-left text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
            <span className="flex-1 text-[13px]">Sair</span>
          </button>
        </div>
      </aside>

      <div className={cn(
        "flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-20"
      )}>
        {/* Mobile Header */}
        <header className="lg:hidden h-14 shrink-0 flex items-center justify-between px-4 bg-card/95 backdrop-blur-sm z-40 border-b border-border/30">
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
        <header className="hidden lg:flex h-16 shrink-0 items-center justify-between px-8 bg-card/50 backdrop-blur-sm z-40 border-b border-border/30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
            </Button>
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
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [WebkitOverflowScrolling:touch] w-full box-border p-3 lg:p-8 pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Fixed bottom bar — Contractions shortcut */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-center pointer-events-none pb-[var(--app-safe-bottom)]">
        <button
          onClick={() => navigate("/gestante/contracoes")}
          className={cn(
            "pointer-events-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90",
            location.pathname === "/gestante/contracoes"
              ? "bg-primary text-primary-foreground shadow-primary/30"
              : "bg-card text-warning border border-border/50 shadow-foreground/10"
          )}
          title="Contrações"
        >
          <Timer className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
