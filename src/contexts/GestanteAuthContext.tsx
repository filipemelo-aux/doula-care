import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ClientData {
  id: string;
  full_name: string;
  first_login: boolean;
  status: "tentante" | "gestante" | "lactante";
  birth_occurred: boolean;
}

interface GestanteAuthContextType {
  user: User | null;
  session: Session | null;
  client: ClientData | null;
  loading: boolean;
  isAuthenticated: boolean;
  isFirstLogin: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshClientData: () => Promise<void>;
  setFirstLoginComplete: () => void;
}

const GestanteAuthContext = createContext<GestanteAuthContextType | undefined>(undefined);

// Session storage keys
const SESSION_KEY = "gestante_session_active";

export function GestanteAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  const fetchClientData = useCallback(async (userId: string): Promise<ClientData | null> => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, first_login, status, birth_occurred")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching client data:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error fetching client data:", error);
      return null;
    }
  }, []);

  const checkIsClientRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "client")
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.error("Error checking client role:", error);
      return false;
    }
  }, []);

  const initializeAuth = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setSession(null);
      setUser(null);
      setClient(null);
      setIsClient(false);
      setLoading(false);
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    const isClientRole = await checkIsClientRole(currentSession.user.id);
    
    if (!isClientRole) {
      // Not a client, don't set up gestante context
      setSession(null);
      setUser(null);
      setClient(null);
      setIsClient(false);
      setLoading(false);
      return;
    }

    const clientData = await fetchClientData(currentSession.user.id);
    
    setSession(currentSession);
    setUser(currentSession.user);
    setClient(clientData);
    setIsClient(true);
    sessionStorage.setItem(SESSION_KEY, "true");
    setLoading(false);
  }, [checkIsClientRole, fetchClientData]);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        console.log("GestanteAuth: Auth state change:", event);

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setClient(null);
          setIsClient(false);
          setLoading(false);
          sessionStorage.removeItem(SESSION_KEY);
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          // Defer to avoid blocking the auth state change
          setTimeout(() => {
            if (isMounted) {
              initializeAuth(currentSession);
            }
          }, 0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted) {
        initializeAuth(currentSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initializeAuth]);

  const signIn = async (username: string, password: string): Promise<{ error: Error | null }> => {
    try {
      // Format base email from username
      const baseUsername = username.includes("@") ? username.split("@")[0] : username;
      
      // First, try to find the actual email in auth.users by looking up the client
      // This handles cases where the email has a numeric suffix (e.g., antonia.santos.8817)
      let email = `${baseUsername}@gestante.doula.app`;
      
      // Query clients table to find the user_id, then we can get the actual email
      const { data: clientsData } = await supabase
        .from("clients")
        .select("user_id")
        .not("user_id", "is", null);
      
      if (clientsData && clientsData.length > 0) {
        // We need to find if there's a user with email starting with the base username
        // Try the exact email first, if it fails, we'll search for alternatives
      }

      // Try to sign in with the base email first
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // If login failed with base email, try to find alternative email with suffix
      if (error && error.message.includes("Invalid login credentials")) {
        // Search for clients whose user has an email starting with the base username
        const { data: allClients } = await supabase
          .from("clients")
          .select("user_id, full_name")
          .not("user_id", "is", null);
        
        if (allClients) {
          // Generate expected username from each client's name and compare
          for (const client of allClients) {
            const nameParts = client.full_name
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .trim()
              .split(/\s+/);
            
            if (nameParts.length >= 2) {
              const expectedUsername = `${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
              
              if (expectedUsername === baseUsername) {
                // Found a matching client, try to get the actual email from their session
                // We need to use edge function to get the real email
                const response = await supabase.functions.invoke("get-client-email", {
                  body: { userId: client.user_id }
                });
                
                if (response.data?.email) {
                  email = response.data.email;
                  // Try login with the actual email
                  const retryResult = await supabase.auth.signInWithPassword({
                    email,
                    password,
                  });
                  data = retryResult.data;
                  error = retryResult.error;
                  break;
                }
              }
            }
          }
        }
      }

      if (error) {
        return { error: error as Error };
      }

      if (data.session) {
        // Verify this is a client user
        const isClientRole = await checkIsClientRole(data.session.user.id);
        
        if (!isClientRole) {
          await supabase.auth.signOut();
          return { error: new Error("Usuário não autorizado para esta área") };
        }

        const clientData = await fetchClientData(data.session.user.id);
        
        setSession(data.session);
        setUser(data.session.user);
        setClient(clientData);
        setIsClient(true);
        sessionStorage.setItem(SESSION_KEY, "true");
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async (): Promise<void> => {
    // Clear local state immediately
    setSession(null);
    setUser(null);
    setClient(null);
    setIsClient(false);
    sessionStorage.removeItem(SESSION_KEY);
    
    // Clear any stored auth data
    localStorage.removeItem("sb-gjnvxzsforfrxjanxqnq-auth-token");

    try {
      // Sign out from Supabase - use local scope to avoid errors when session is already invalid
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      // Ignore errors - session might already be invalid on server
      console.log("Sign out completed (session may have been already invalid)");
    }

    // Force full page reload to clear all state
    window.location.href = "/gestante/login";
  };

  const refreshClientData = async (): Promise<void> => {
    if (!user) return;
    
    const clientData = await fetchClientData(user.id);
    setClient(clientData);
  };

  const setFirstLoginComplete = (): void => {
    if (client) {
      setClient({ ...client, first_login: false });
    }
  };

  const value: GestanteAuthContextType = {
    user,
    session,
    client,
    loading,
    isAuthenticated: isClient && !!session,
    isFirstLogin: client?.first_login ?? false,
    signIn,
    signOut,
    refreshClientData,
    setFirstLoginComplete,
  };

  return (
    <GestanteAuthContext.Provider value={value}>
      {children}
    </GestanteAuthContext.Provider>
  );
}

export function useGestanteAuth() {
  const context = useContext(GestanteAuthContext);
  if (context === undefined) {
    throw new Error("useGestanteAuth must be used within a GestanteAuthProvider");
  }
  return context;
}
