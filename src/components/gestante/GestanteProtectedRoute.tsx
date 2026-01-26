import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface GestanteProtectedRouteProps {
  children: React.ReactNode;
}

export function GestanteProtectedRoute({ children }: GestanteProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setLoading(false);
          return;
        }

        // Check if user has client role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "client")
          .maybeSingle();

        if (!roleData) {
          setLoading(false);
          return;
        }

        setIsClient(true);

        // Check if first login
        const { data: clientData } = await supabase
          .from("clients")
          .select("first_login")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setIsFirstLogin(clientData?.first_login ?? false);
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (!isClient) {
    return <Navigate to="/gestante/login" state={{ from: location }} replace />;
  }

  // Force password change on first login (except if already on change password page)
  if (isFirstLogin && location.pathname !== "/gestante/alterar-senha") {
    return <Navigate to="/gestante/alterar-senha" replace />;
  }

  return <>{children}</>;
}
