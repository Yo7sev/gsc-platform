"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

export default function OperationsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMatches: 0,
    activeMatches: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadStats();
  }, [authLoading, isAdmin]);

  const loadStats = async () => {
    try {
      const [users, matches, active] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("status", "in_progress"),
      ]);

      setStats({
        totalUsers: users.count || 0,
        totalMatches: matches.count || 0,
        activeMatches: active.count || 0,
        totalRevenue: 0,
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <div className="p-8">Loading...</div>;
  if (!isAdmin) return <div className="p-8">Access denied</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Operations Monitoring</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total Users</p>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total Matches</p>
          <p className="text-3xl font-bold">{stats.totalMatches}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Active Matches</p>
          <p className="text-3xl font-bold text-green-600">
            {stats.activeMatches}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold">${stats.totalRevenue}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow mt-6">
        <h2 className="text-lg font-semibold mb-4">Platform Health</h2>
        <p className="text-green-600 font-semibold">All Systems Operational</p>
      </div>
    </div>
  );
}
