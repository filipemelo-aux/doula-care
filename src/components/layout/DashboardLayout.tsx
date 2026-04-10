import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu, LogOut, ChevronLeft, LayoutDashboard, Users, CalendarDays, MessageCircle, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { PushNotificationToggle } from "@/components/pwa/PushNotificationToggle";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { usePresenceBroadcast } from "@/hooks/usePresence";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";
import { useActiveLaborCount } from "@/hooks/useActiveLaborCount";
import { BirthAlertDialog } from "@/components/dashboard/BirthAlertDialog";
import { NotificationTopBanner } from "@/components/dashboard/NotificationTopBanner";
import { ExpiredPlanBanner } from "@/components/dashboard/ExpiredPlanBanner";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [birthAlertOpen, setBirthAlertOpen] = useState(false);
  const { signOut } = useAuth();
  const { logoUrl: orgLogo, displayName, brandingReady } = useOrgBranding();
  const { unreadMessages } = useAdminUnreadCounts();
  const { laborCount, alertCount, markAsSeen } = useActiveLaborCount();
  const location = useLocation();
  const navigate = useNavigate();
  usePresenceBroadcast();
  const headerLogo = orgLogo || logo;
  const headerName = displayName || "Doula Care";

  const handleNavigate = () => {
    setSidebarOpen(false);
  };

  if (!brandingReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-[40%] overflow-hidden">
            <img src={headerLogo} alt={headerName} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell h-[100dvh] flex w-full bg-background overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onNavigate={handleNavigate}
      />

      <div className={cn("flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden transition-all duration-300", sidebarOpen ? "lg:ml-64" : "lg:ml-20")}>
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
                <img src={headerLogo} alt={headerName} className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
              </div>
              <h1 className="font-display text-lg text-foreground">{headerName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PushNotificationToggle compact />
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
              <LogOut className="h-5 w-5 text-muted-foreground" />
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
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </header>

        <main className="flex-1 min-h-0 p-3 lg:p-8 pb-24 lg:pb-8 overflow-y-auto overscroll-y-contain touch-pan-y [WebkitOverflowScrolling:touch] w-full box-border">
          <div className="max-w-7xl mx-auto animate-fade-in space-y-4 lg:space-y-6">
            <ExpiredPlanBanner />
            <NotificationTopBanner />
            <Outlet />
          </div>
        </main>
      </div>

      {/* Fixed bottom navigation bar — mobile only */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-[var(--app-safe-bottom)]",
        "bg-[hsl(var(--background))] shadow-[0_-1px_12px_-4px_hsl(var(--foreground)/0.08)]",
        sidebarOpen && "hidden"
      )}>
        <div className="flex items-end justify-evenly px-2 py-1.5 relative max-w-md mx-auto">
          {/* Visão Geral */}
          {(() => {
            const isActive = location.pathname === "/admin";
            return (
              <button
                onClick={() => navigate("/admin")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[14px] transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/85"
                )}
              >
                <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.6} />
                <span className="text-[9px] font-medium leading-none">Início</span>
              </button>
            );
          })()}

          {/* Clientes */}
          {(() => {
            const isActive = location.pathname === "/clientes";
            return (
              <button
                onClick={() => navigate("/clientes")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[14px] transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/85"
                )}
              >
                <Users className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.6} />
                <span className="text-[9px] font-medium leading-none">Clientes</span>
              </button>
            );
          })()}

          {/* FAB — Alertas de Parto */}
          <div className="flex flex-col items-center justify-end gap-1 px-3 py-2">
            <div className="relative flex items-center justify-center" style={{ marginTop: '-30px' }}>
              <button
                onClick={() => { setBirthAlertOpen(true); markAsSeen(); }}
                className={cn(
                  "w-[48px] h-[48px] rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ring-4 ring-[hsl(var(--background))] bg-gradient-to-br from-warning to-warning/80 text-warning-foreground shadow-warning/25",
                  laborCount > 0 && "animate-pulse from-destructive to-destructive/80 shadow-destructive/40"
                )}
                title="Alertas de Parto"
              >
                <Baby className="h-5 w-5" strokeWidth={2.2} />
              </button>
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold ring-2 ring-[hsl(var(--background))]">
                  {alertCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium leading-none text-sidebar-foreground/50">Alertas</span>
          </div>

          {/* Agenda */}
          {(() => {
            const isActive = location.pathname === "/agenda";
            return (
              <button
                onClick={() => navigate("/agenda")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[14px] transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/85"
                )}
              >
                <CalendarDays className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.6} />
                <span className="text-[9px] font-medium leading-none">Agenda</span>
              </button>
            );
          })()}

          {/* Mensagens */}
          {(() => {
            const isActive = location.pathname === "/mensagens";
            return (
              <button
                onClick={() => navigate("/mensagens")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[14px] transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/85"
                )}
              >
                <div className="relative">
                  <MessageCircle className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.6} />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center font-bold">
                      {unreadMessages}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium leading-none">Mensagens</span>
              </button>
            );
          })()}
        </div>
      </div>

      {/* Birth Alert Dialog */}
      <BirthAlertDialog open={birthAlertOpen} onOpenChange={setBirthAlertOpen} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
