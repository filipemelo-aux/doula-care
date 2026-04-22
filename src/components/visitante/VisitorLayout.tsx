import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Heart, LayoutDashboard, BookHeart, Timer, CircleUserRound, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface VisitorLayoutProps {
  children: ReactNode;
  avatarUrl?: string | null;
  greetingTop?: string;
  greetingName?: string;
}

export function VisitorLayout({ children, avatarUrl, greetingTop, greetingName }: VisitorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, client } = useAuth();

  const displayName =
    greetingName ||
    (client as any)?.preferred_name ||
    (client as any)?.full_name?.split(" ")[0] ||
    "visitante";

  return (
    <div className="app-shell h-[100dvh] flex flex-col bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Top header (padronizado h-14 — igual admin/gestante) */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-card/95 backdrop-blur-sm z-40 border-b border-border/30">
        <div
          className="flex items-center gap-2 min-w-0 cursor-pointer"
          onClick={() => navigate("/visitante")}
        >
          <div className="w-9 h-9 rounded-[40%] bg-[hsl(var(--muted))] overflow-hidden shrink-0">
            <img src={logo} alt="Doula Care" className="w-full h-full object-cover mix-blend-multiply scale-[1.15]" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">Doula Care</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              Sua jornada, com cuidado 💗
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          title="Sair"
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y w-full box-border p-3 pb-24">
        <div className="max-w-3xl mx-auto animate-fade-in">{children}</div>
      </main>

      {/* Bottom nav with center FAB for "Buscar Doula" */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-[var(--app-safe-bottom)] bg-[hsl(var(--background))] shadow-[0_-1px_12px_-4px_hsl(var(--foreground)/0.08)]">
        <div className="flex items-end justify-evenly px-2 py-1.5 relative max-w-md mx-auto">
          <NavItem
            label="Início"
            icon={LayoutDashboard}
            active={location.pathname === "/visitante"}
            onClick={() => navigate("/visitante")}
          />
          <NavItem
            label="Diário"
            icon={BookHeart}
            active={location.pathname === "/visitante/diario"}
            onClick={() => navigate("/visitante/diario")}
          />

          {/* Center FAB — Buscar Doula */}
          <div className="flex flex-col items-center justify-end gap-1 px-3 py-2">
            <div className="relative flex items-center justify-center" style={{ marginTop: "-30px" }}>
              <button
                onClick={() => navigate("/visitante/buscar")}
                className={cn(
                  "w-[48px] h-[48px] rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ring-4 ring-[hsl(var(--background))]",
                  "bg-gradient-to-br from-warning to-warning/80 text-warning-foreground shadow-warning/25"
                )}
                title="Buscar doula"
              >
                <Search className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
            <span className="text-[9px] font-medium leading-none text-sidebar-foreground/50">Buscar</span>
          </div>

          <NavItem
            label="Contrações"
            icon={Timer}
            active={location.pathname === "/visitante/contracoes"}
            onClick={() => navigate("/visitante/contracoes")}
          />
          <NavItem
            label="Perfil"
            icon={CircleUserRound}
            active={location.pathname === "/visitante/perfil"}
            onClick={() => navigate("/visitante/perfil")}
          />
        </div>
      </div>
    </div>
  );
}

function NavItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[14px] transition-all duration-200 active:scale-[0.97]",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/85"
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.6} />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}
