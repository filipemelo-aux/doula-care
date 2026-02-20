import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("admin" | "moderator" | "client" | "user")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, role, roleChecked, isFirstLogin } = useAuth();
  const location = useLocation();

  // Show loading during initial auth check or while role check is pending
  if (loading || (user && !roleChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role not in allowed list
  if (roleChecked && role && !allowedRoles.includes(role)) {
    // Redirect to the correct area based on role
    if (role === "admin" || role === "moderator") {
      return <Navigate to="/admin" replace />;
    }
    if (role === "client") {
      return <Navigate to="/gestante" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // No role found
  if (roleChecked && !role) {
    return <Navigate to="/login" replace />;
  }

  // Client first login: force password change
  if (role === "client" && isFirstLogin && location.pathname !== "/gestante/alterar-senha") {
    return <Navigate to="/gestante/alterar-senha" replace />;
  }

  return <>{children}</>;
}
