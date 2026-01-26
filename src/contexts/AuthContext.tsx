import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  roleChecked: boolean; // New: indicates if role check has completed
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "moderator"])
        .maybeSingle();

      if (error) {
        console.error("Error checking admin role:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Error checking admin role:", error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // Set up auth state listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        // Handle sign out event - don't try to check roles
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setRoleChecked(true);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Check admin role - use setTimeout to avoid blocking the auth state change
          setTimeout(async () => {
            if (!isMounted) return;
            const admin = await checkAdminRole(session.user.id);
            if (isMounted) {
              setIsAdmin(admin);
              setRoleChecked(true);
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setRoleChecked(true);
        }

        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const admin = await checkAdminRole(session.user.id);
        if (isMounted) {
          setIsAdmin(admin);
          setRoleChecked(true);
        }
      } else {
        setRoleChecked(true);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setRoleChecked(false); // Reset role check state
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear local state first
    setIsAdmin(false);
    setUser(null);
    setSession(null);
    setRoleChecked(false);
    
    try {
      // Sign out globally to clear all sessions
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error("Error signing out:", error);
    }
    
    // Force a full page reload to clear all state and redirect
    window.location.href = "/admin/login";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, roleChecked, signIn, signOut }}>
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
