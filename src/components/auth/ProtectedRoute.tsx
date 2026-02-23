import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("admin" | "moderator" | "client" | "user" | "super_admin")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, role, roleChecked, isFirstLogin, orgStatus, signOut } = useAuth();
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
    if (role === "super_admin") return <Navigate to="/super-admin" replace />;
    if (role === "admin" || role === "moderator") return <Navigate to="/admin" replace />;
    if (role === "client") return <Navigate to="/gestante" replace />;
    return <Navigate to="/login" replace />;
  }

  // No role found
  if (roleChecked && !role) {
    return <Navigate to="/login" replace />;
  }

  // Organization pending approval (skip for super_admin)
  if (role !== "super_admin" && orgStatus === "pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              </div>
            </div>
            <CardTitle className="text-xl">Cadastro em Análise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Seu cadastro foi recebido e está aguardando aprovação do administrador da plataforma.
              Você será notificada assim que seu acesso for liberado.
            </p>
            <Button variant="outline" onClick={signOut} className="w-full">
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization suspended (skip for super_admin)
  if (role !== "super_admin" && orgStatus === "suspenso") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Ban className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-xl">Conta Suspensa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Sua conta foi suspensa pela administração da plataforma. 
              Entre em contato com o suporte para mais informações.
            </p>
            <Button variant="outline" onClick={signOut} className="w-full">
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Client first login: force password change
  if (role === "client" && isFirstLogin && location.pathname !== "/gestante/alterar-senha") {
    return <Navigate to="/gestante/alterar-senha" replace />;
  }

  return <>{children}</>;
}
