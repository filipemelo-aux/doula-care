import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { 
  BookHeart, 
  MessageCircle, 
  Baby, 
  Timer, 
  User,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PushNotificationToggle } from "@/components/pwa/PushNotificationToggle";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-28">
      {/* Top Header with Logo + Logout */}
      <header className="flex items-center justify-between px-4 h-16 bg-card/50 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[40%] bg-[#FFF5EE] overflow-hidden">
            <img src={logo} alt="Papo de Doula" className="w-full h-full object-cover mix-blend-multiply scale-[1.35]" />
          </div>
          <h1 className="font-display text-lg text-foreground">Papo de Doula</h1>
        </div>
        <div className="flex items-center gap-1">
          <PushNotificationToggle compact />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-5rem)]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
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
        <div className="h-10 bg-background" />
      </nav>
    </div>
  );
}
