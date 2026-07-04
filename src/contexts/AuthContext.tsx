import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "client" | "user" | "super_admin" | "visitor";
type AppRoles = AppRole[];

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
  roles: AppRoles;
  roleChecked: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isSuperAdmin: boolean;
  isVisitor: boolean;
  client: ClientData | null;
  isFirstLogin: boolean;
  mustChangePassword: boolean;
  profileName: string | null;
  organizationId: string | null;
  orgStatus: OrgStatus | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshClientData: () => Promise<void>;
  refreshMustChangePassword: () => Promise<void>;
  setFirstLoginComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRoles>([]);
  const [roleChecked, setRoleChecked] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null);
  // Flag to prevent onAuthStateChange from re-running initializeUser when signIn already handled it
  const signInHandledRef = useRef(false);
  const accessLoggedRef = useRef<string | null>(null);

  const fetchRoles = useCallback(async (userId: string): Promise<AppRoles> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching roles:", error);
        return [];
      }

      return (data?.map(r => r.role as AppRole) ?? []);
    } catch (error) {
      console.error("Error fetching roles:", error);
      return [];
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
      setRoles([]);
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
      const userRoles = await fetchRoles(currentSession.user.id);
      setRoles(userRoles);

      let primaryRole: AppRole | null = null;
      if (userRoles.length > 0) {
        const priority: AppRole[] = ["super_admin", "admin", "moderator", "client", "visitor", "user"];
        primaryRole = priority.find(r => userRoles.includes(r)) || userRoles[0];
      }
      setRole(primaryRole);

      if (primaryRole === "client" || primaryRole === "visitor") {
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

    // Log access for the organization (fire-and-forget, once per session per user)
    const userId = currentSession.user.id;
    if (accessLoggedRef.current !== userId) {
      accessLoggedRef.current = userId;
      // Resolve orgId from what was just set
      const resolveOrgId = async () => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", userId)
          .maybeSingle();
        const oid = prof?.organization_id;
        if (!oid) {
          // Try client
          const { data: cli } = await supabase
            .from("clients")
            .select("organization_id")
            .eq("user_id", userId)
            .maybeSingle();
          return cli?.organization_id || null;
        }
        return oid;
      };
      resolveOrgId().then((oid) => {
        if (oid) {
          supabase.from("org_access_log").insert({ user_id: userId, organization_id: oid } as any).then(() => {});
        }
      });
    }
  }, [fetchRoles, fetchClientData]);

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
          setRoles([]);
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

          // If signIn() already handled initialization, skip duplicate call
          if (event === "SIGNED_IN" && signInHandledRef.current) {
            signInHandledRef.current = false;
            return;
          }

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
        const sessionPromise = supabase.auth.getSession();
        // Safety timeout: if getSession hangs (e.g. preview proxy), unblock UI after 5s
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 5000)
        );
        const { data: { session: currentSession } } = await Promise.race([sessionPromise, timeoutPromise]);
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

      // Support username-based login for clients (nome.sobrenome → email)
      let loginEmail = email;
      if (!email.includes("@")) {
        loginEmail = `${email}@gestante.doula.app`;
      }

      let { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      // If login failed with generated email, try resolving via edge function (bypasses RLS)
      if (error && error.message.includes("Invalid login credentials") && !email.includes("@")) {
        try {
          const response = await supabase.functions.invoke("resolve-client-login", {
            body: { username: email.toLowerCase() },
          });

          if (response.data?.email) {
            const retryResult = await supabase.auth.signInWithPassword({
              email: response.data.email,
              password,
            });
            data = retryResult.data;
            error = retryResult.error;
          }
        } catch (resolveError) {
          console.error("Error resolving client login:", resolveError);
        }
      }

      if (error) {
        setLoading(false);
        setRoleChecked(true);
        return { error: error as Error };
      }

      // Directly initialize user data instead of relying on onAuthStateChange
      // This avoids race conditions and stale closures
      if (data?.session) {
        signInHandledRef.current = true;
        await initializeUser(data.session);
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
    setRoles([]);
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
  const isSuperAdmin = roles.includes("super_admin");
  const isVisitor = role === "visitor";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        roles,
        roleChecked,
        isAdmin,
        isClient,
        isSuperAdmin,
        isVisitor,
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
