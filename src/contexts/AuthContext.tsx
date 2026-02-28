import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "client" | "user" | "super_admin";

interface ClientData {
  id: string;
  full_name: string;
  first_login: boolean;
  status: "tentante" | "gestante" | "lactante" | "outro";
  birth_occurred: boolean;
  organization_id: string | null;
}

type OrgStatus = "ativo" | "suspenso" | "pendente";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  roleChecked: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isSuperAdmin: boolean;
  client: ClientData | null;
  isFirstLogin: boolean;
  profileName: string | null;
  organizationId: string | null;
  orgStatus: OrgStatus | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshClientData: () => Promise<void>;
  setFirstLoginComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null);

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
        .select("id, full_name, first_login, status, birth_occurred, organization_id")
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
      setProfileName(null);
      setOrganizationId(null);
      setOrgStatus(null);
      setRoleChecked(true);
      setLoading(false);
      return;
    }

    setSession(currentSession);
    setUser(currentSession.user);

    try {
      const userRole = await fetchRole(currentSession.user.id);
      setRole(userRole);

      if (userRole === "client") {
        const clientData = await fetchClientData(currentSession.user.id);
        setClient(clientData);
        setProfileName(clientData?.full_name || null);
        const orgIdFromClient = clientData?.organization_id || null;
        if (orgIdFromClient) {
          setOrganizationId(orgIdFromClient);
          const { data: org } = await supabase.from("organizations").select("status").eq("id", orgIdFromClient).single();
          setOrgStatus((org?.status as OrgStatus) || null);
        } else {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("user_id", currentSession.user.id)
              .maybeSingle();
            const orgId = profile?.organization_id || null;
            setOrganizationId(orgId);
            if (orgId) {
              const { data: org } = await supabase.from("organizations").select("status").eq("id", orgId).single();
              setOrgStatus((org?.status as OrgStatus) || null);
            }
          } catch {
            setOrganizationId(null);
            setOrgStatus(null);
          }
        }
      } else {
        setClient(null);
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, organization_id")
            .eq("user_id", currentSession.user.id)
            .maybeSingle();
          setProfileName(profile?.full_name || null);
          const orgId = profile?.organization_id || null;
          setOrganizationId(orgId);
          if (orgId) {
            const { data: org } = await supabase.from("organizations").select("status").eq("id", orgId).single();
            setOrgStatus((org?.status as OrgStatus) || null);
          }
        } catch {
          setProfileName(null);
          setOrganizationId(null);
          setOrgStatus(null);
        }
      }
    } catch (error) {
      console.error("Error initializing user data:", error);
    }

    setRoleChecked(true);
    setLoading(false);
  }, [fetchRole, fetchClientData]);

  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;

    // 1. Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setRole(null);
           setClient(null);
           setProfileName(null);
           setOrganizationId(null);
           setOrgStatus(null);
           setRoleChecked(true);
           setLoading(false);
          return;
        }

        // Skip INITIAL_SESSION — handled by getSession below
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Update session/user immediately (sync)
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          // Dispatch async work AFTER callback to avoid deadlock
          setTimeout(() => {
            if (isMounted && initialLoadDone) {
              initializeUser(currentSession);
            }
          }, 0);
        }
      }
    );

    // 2. INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted) return;
        await initializeUser(currentSession);
      } catch {
        if (isMounted) {
          setLoading(false);
          setRoleChecked(true);
        }
      } finally {
        initialLoadDone = true;
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initializeUser]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      setRoleChecked(false);
      setLoading(true);

      // Safety timeout: if role check doesn't complete in 15s, reset loading state
      const safetyTimeout = setTimeout(() => {
        console.warn("Login safety timeout triggered - resetting loading state");
        setLoading(false);
        setRoleChecked(true);
      }, 15000);

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
        clearTimeout(safetyTimeout);
        setLoading(false);
        setRoleChecked(true);
        return { error: error as Error };
      }

      // If onAuthStateChange doesn't trigger, manually initialize
      if (data?.session) {
        // Give onAuthStateChange a moment to fire first
        setTimeout(async () => {
          // If still not role-checked after 3s, do it manually
          if (!roleChecked) {
            console.warn("onAuthStateChange did not trigger, initializing manually");
            await initializeUser(data.session);
          }
          clearTimeout(safetyTimeout);
        }, 3000);
      }

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
    setOrganizationId(null);
    setRoleChecked(false);

    // Clear all auth storage before signing out to prevent re-authentication
    const storageKey = `sb-gjnvxzsforfrxjanxqnq-auth-token`;
    localStorage.removeItem(storageKey);
    sessionStorage.clear();

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("Error signing out:", error);
    }

    navigate("/login", { replace: true });
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
  const isSuperAdmin = role === "super_admin";

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
        isSuperAdmin,
        client,
        isFirstLogin: client?.first_login ?? false,
        profileName,
        organizationId,
        orgStatus,
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
