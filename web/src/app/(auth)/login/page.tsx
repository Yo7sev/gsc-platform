"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) throw authError;
      if (!data.user) throw new Error("Login failed. Please try again.");

      // Check if banned
      const { data: userData } = await supabase
        .from("users")
        .select("is_banned")
        .eq("id", data.user.id)
        .single();

      if (userData?.is_banned) {
        await supabase.auth.signOut();
        setError("Your account has been banned. Please contact support for more information.");
        return;
      }

      // Check role
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const roles = (roleRows || []).map((r) => r.role);

      // Block players — web is for admins and organizers only
      const hasWebAccess = roles.includes("main_admin") || roles.includes("admin") || roles.includes("organizer");
      if (!hasWebAccess) {
        await supabase.auth.signOut();
        setError("This platform is for organizers and admins only. Please use the GSC mobile app to access your player account.");
        return;
      }

      // Block pending/rejected organizers (not admins)
      if (roles.includes("organizer") && !roles.includes("main_admin") && !roles.includes("admin")) {
        const { data: verification } = await supabase
          .from("verifications")
          .select("status")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (verification?.status === "pending") {
          await supabase.auth.signOut();
          setError("Your organizer application is still under review. You will be notified by email once approved.");
          return;
        }

        if (verification?.status === "rejected") {
          await supabase.auth.signOut();
          setError("Your organizer application was rejected. Please contact support for more information.");
          return;
        }
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 text-sm mt-2">
            GSC Platform — Organizers & Admins only
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white p-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {"Want to become an organizer? "}
          <Link href="/register" className="text-green-600 font-semibold hover:underline">
            Apply here
          </Link>
        </p>
      </div>
    </div>
  );
}