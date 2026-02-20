// Compatibility layer: useGestanteAuth now reads from the unified AuthContext
import { useAuth } from "@/contexts/AuthContext";

export function useGestanteAuth() {
  const auth = useAuth();

  return {
    user: auth.user,
    session: auth.session,
    client: auth.client,
    loading: auth.loading,
    isAuthenticated: auth.isClient && !!auth.session,
    isFirstLogin: auth.isFirstLogin,
    signIn: async (username: string, password: string) => {
      // Client login uses username format (no @)
      return auth.signIn(username, password);
    },
    signOut: auth.signOut,
    refreshClientData: auth.refreshClientData,
    setFirstLoginComplete: auth.setFirstLoginComplete,
  };
}

// Re-export for backward compatibility
export { useGestanteAuth as useGestanteAuthContext };
