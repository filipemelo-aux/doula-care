import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "client" | "user";

interface ClientData {
  id: string;
  full_name: string;
  first_login: boolean;
  status: "tentante" | "gestante" | "lactante";
  birth_occurred: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  roleChecked: boolean;
  isAdmin: boolean;
  isClient: boolean;
  client: ClientData | null;
  isFirstLogin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshClientData: () => Promise<void>;
  setFirstLoginComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);

  const fetchRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        return null;
      }

      return (data?.role as AppRole) ?? null;
    } catch (error) {
      console.error("Error fetching role:", error);
      return null;
    }
  }, []);

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

  const initializeUser = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setSession(null);
      setUser(null);
      setRole(null);
      setClient(null);
      setRoleChecked(true);
      setLoading(false);
      return;
    }

    setSession(currentSession);
    setUser(currentSession.user);

    const userRole = await fetchRole(currentSession.user.id);
    setRole(userRole);

    if (userRole === "client") {
      const clientData = await fetchClientData(currentSession.user.id);
      setClient(clientData);
    } else {
      setClient(null);
    }

    setRoleChecked(true);
    setLoading(false);
  }, [fetchRole, fetchClientData]);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setRole(null);
          setClient(null);
          setRoleChecked(true);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          setTimeout(() => {
            if (isMounted) {
              initializeUser(currentSession);
            }
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted) {
        initializeUser(currentSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initializeUser]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      setRoleChecked(false);
      setLoading(true);

      // Support username-based login for clients (nome.sobrenome → email)
      let loginEmail = email;
      if (!email.includes("@")) {
        loginEmail = `${email}@gestante.doula.app`;
      }

      let { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      // If login failed with generated email, try alternative email with suffix
      if (error && error.message.includes("Invalid login credentials") && !email.includes("@")) {
        const { data: allClients } = await supabase
          .from("clients")
          .select("user_id, full_name")
          .not("user_id", "is", null);

        if (allClients) {
          const baseUsername = email.toLowerCase();
          for (const c of allClients) {
            const nameParts = c.full_name
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .trim()
              .split(/\s+/);

            if (nameParts.length >= 2) {
              const expectedUsername = `${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
              if (expectedUsername === baseUsername) {
                const response = await supabase.functions.invoke("get-client-email", {
                  body: { userId: c.user_id },
                });

                if (response.data?.email) {
                  const retryResult = await supabase.auth.signInWithPassword({
                    email: response.data.email,
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
        setLoading(false);
        setRoleChecked(true);
        return { error: error as Error };
      }

      // initializeUser will be called by onAuthStateChange
      return { error: null };
    } catch (error) {
      setLoading(false);
      setRoleChecked(true);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    setRole(null);
    setUser(null);
    setSession(null);
    setClient(null);
    setRoleChecked(false);

    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("Error signing out:", error);
    }

    window.location.href = "/login";
  };

  const refreshClientData = async () => {
    if (!user) return;
    const clientData = await fetchClientData(user.id);
    setClient(clientData);
  };

  const setFirstLoginComplete = () => {
    if (client) {
      setClient({ ...client, first_login: false });
    }
  };

  const isAdmin = role === "admin" || role === "moderator";
  const isClient = role === "client";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        roleChecked,
        isAdmin,
        isClient,
        client,
        isFirstLogin: client?.first_login ?? false,
        signIn,
        signOut,
        refreshClientData,
        setFirstLoginComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
