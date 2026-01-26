import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, roleChecked } = useAuth();
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

  // No user means not authenticated - redirect to admin login
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Role check completed but user is not admin - redirect to admin login
  if (roleChecked && !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  // Check if admin access is required but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
