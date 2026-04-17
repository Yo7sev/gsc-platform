"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "main_admin" | "admin" | "organizer" | "player";

type User = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  average_rating?: number | null;
  created_at?: string | null;
  is_banned?: boolean | null;
};

interface AuthContextType {
  user: User | null;
  roles: UserRole[];
  loading: boolean;
  isMainAdmin: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  verificationStatus: "approved" | "pending" | "rejected" | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  roles: [],
  loading: true,
  isMainAdmin: false,
  isAdmin: false,
  isOrganizer: false,
  verificationStatus: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<
    "approved" | "pending" | "rejected" | null
  >(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = async () => {
    try {
      setLoading(true);

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setUser(null);
        setRoles([]);
        setVerificationStatus(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, email, full_name, average_rating, created_at, is_banned")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("users query error:", profileError);
      }

      const safeUser: User = {
        id: authUser.id,
        email: profile?.email ?? authUser.email ?? null,
        full_name: profile?.full_name ?? null,
        average_rating: profile?.average_rating ?? null,
        created_at: profile?.created_at ?? null,
        is_banned: profile?.is_banned ?? null,
      };

      if (safeUser.is_banned) {
        await supabase.auth.signOut();
        setUser(null);
        setRoles([]);
        setVerificationStatus(null);
        return;
      }

      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id);

      if (rolesError) {
        console.error("user_roles query error:", rolesError);
      }

      const fetchedRoles = (roleRows ?? [])
        .map((r) => r.role)
        .filter(
          (role): role is UserRole =>
            role === "main_admin" ||
            role === "admin" ||
            role === "organizer" ||
            role === "player",
        );

      const isAdminLike =
        fetchedRoles.includes("main_admin") || fetchedRoles.includes("admin");

      let status: "approved" | "pending" | "rejected" | null = null;

      if (fetchedRoles.includes("organizer") && !isAdminLike) {
        const { data: verification, error: verificationError } = await supabase
          .from("verifications") // replace with organizer_verifications if that is your real table
          .select("status")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verificationError) {
          console.error("verifications query error:", verificationError);
        }

        status = verification?.status ?? null;
      }

      setUser(safeUser);
      setRoles(fetchedRoles);
      setVerificationStatus(status);
    } catch (err) {
      console.error("AUTH PROVIDER FATAL ERROR:", err);
      setUser(null);
      setRoles([]);
      setVerificationStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      void loadAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const rolesArr = roles ?? [];

  return (
    <AuthContext.Provider
      value={{
        user,
        roles: rolesArr,
        loading,
        isMainAdmin: rolesArr.includes("main_admin"),
        isAdmin: rolesArr.includes("main_admin") || rolesArr.includes("admin"),
        isOrganizer: rolesArr.includes("organizer"),
        verificationStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
