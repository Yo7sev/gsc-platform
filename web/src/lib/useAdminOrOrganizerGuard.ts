import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AllowedRole = "main_admin" | "organizer";

export function useAdminOrOrganizerGuard(
  allowed: AllowedRole[] = ["main_admin", "organizer"],
) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", allowed);

        if (!isMounted) return;

        if (!roles || roles.length === 0) {
          router.push("/"); // ← fixed from "/dashboard"
          return;
        }

        setAuthorized(true);
      } catch (err) {
        console.error(err);
        if (isMounted) router.push("/login");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    check();
    return () => {
      isMounted = false;
    };
  }, [router, JSON.stringify(allowed)]); // ← fixed missing dep

  return { authorized, loading };
}
