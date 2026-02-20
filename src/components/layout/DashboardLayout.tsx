import { useState } from "react";
import logo from "@/assets/logo.png";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { PushNotificationToggle } from "@/components/pwa/PushNotificationToggle";

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useAuth();

  const handleNavigate = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onNavigate={handleNavigate}
      />

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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[22%] bg-[#FFF5EE] flex items-center justify-center">
                <img src={logo} alt="Papo de Doula" className="w-[78%] h-[78%] object-contain" />
              </div>
              <h1 className="font-display text-lg text-foreground">Papo de Doula</h1>
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
        <header className="hidden lg:flex h-16 border-b border-border items-center justify-end px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </header>

        <main className="flex-1 p-3 lg:p-8 overflow-y-auto w-full box-border">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
