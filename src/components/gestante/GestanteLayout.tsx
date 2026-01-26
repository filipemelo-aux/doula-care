import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  BookHeart, 
  MessageCircle, 
  Baby, 
  Timer, 
  User,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GestanteLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/gestante", icon: Baby, label: "Início" },
  { to: "/gestante/diario", icon: BookHeart, label: "Diário" },
  { to: "/gestante/mensagens", icon: MessageCircle, label: "Mensagens" },
  { to: "/gestante/contracoes", icon: Timer, label: "Contrações" },
  { to: "/gestante/perfil", icon: User, label: "Perfil" },
];

export function GestanteLayout({ children }: GestanteLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useGestanteAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-28">
      {/* Header with Logout Button */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b h-12 flex items-center justify-end px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sair</p>
          </TooltipContent>
        </Tooltip>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-5rem)] pt-12">
        {children}
      </main>

      {/* Bottom Navigation - elevated above Lovable branding */}
      <nav className="fixed bottom-10 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-b safe-area-bottom shadow-lg">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "text-primary"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
