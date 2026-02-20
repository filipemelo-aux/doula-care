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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

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
  const { signOut, client } = useAuth();

  const firstName = client?.full_name?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-28">
      {/* Header - same h-16 as admin */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-16 bg-background/80 backdrop-blur-sm border-b border-border">
        <h1 className="font-display text-lg text-foreground">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
        <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
          <LogOut className="h-5 w-5 text-muted-foreground" />
        </Button>
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
