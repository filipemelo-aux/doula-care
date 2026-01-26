import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  BookHeart, 
  MessageCircle, 
  Baby, 
  Timer, 
  User 
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20">
      {/* Main Content */}
      <main className="min-h-[calc(100vh-5rem)]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t safe-area-bottom">
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
