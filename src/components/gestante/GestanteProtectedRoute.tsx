import { Navigate, useLocation } from "react-router-dom";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Loader2 } from "lucide-react";

interface GestanteProtectedRouteProps {
  children: React.ReactNode;
}

export function GestanteProtectedRoute({ children }: GestanteProtectedRouteProps) {
  const { loading, isAuthenticated, isFirstLogin } = useGestanteAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/gestante/login" state={{ from: location }} replace />;
  }

  // Force password change on first login (except if already on change password page)
  if (isFirstLogin && location.pathname !== "/gestante/alterar-senha") {
    return <Navigate to="/gestante/alterar-senha" replace />;
  }

  return <>{children}</>;
}
