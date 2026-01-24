import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  // Start collapsed on mobile, expanded on desktop
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const handleNavigate = () => {
    // Always close sidebar after navigation (both mobile and desktop)
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onNavigate={handleNavigate}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl text-foreground">Doula Care</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
