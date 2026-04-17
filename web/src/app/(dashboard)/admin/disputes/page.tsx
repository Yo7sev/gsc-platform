"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

interface Dispute {
  id: string;
  created_at: string;
  reason: string;
  status: "open" | "resolved";
  resolved_at?: string;
  match_id?: string;
  matches: {
    title: string;
  } | null;
  reporter: {
    full_name: string | null;
  } | null;
  reported: {
    full_name: string | null;
  } | null;
}

export default function DisputesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadData();
  }, [authLoading, isAdmin]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("disputes")
        .select(
          `
          *,
          matches(title),
          reporter:users!disputes_reporter_id_fkey(full_name),
          reported:users!disputes_reported_id_fkey(full_name)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDisputes((data as unknown as Dispute[]) || []);
    } catch (error) {
      console.error("Error fetching disputes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    const resolution = prompt("Enter resolution notes:");
    if (!resolution) return;

    const { error } = await supabase
      .from("disputes")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert("Failed to resolve dispute");
      console.error(error);
    } else {
      loadData();
    }
  };

  if (authLoading || loading)
    return <div className="p-8 text-gray-600">Loading...</div>;
  if (!isAdmin)
    return <div className="p-8 text-red-600 font-medium">Access denied</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Dispute Resolution
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total</p>
          <p className="text-3xl font-bold">{disputes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Open</p>
          <p className="text-3xl font-bold text-red-600">
            {disputes.filter((d) => d.status === "open").length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Resolved</p>
          <p className="text-3xl font-bold text-green-600">
            {disputes.filter((d) => d.status === "resolved").length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        {disputes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No disputes found.
          </div>
        ) : (
          disputes.map((d) => (
            <div
              key={d.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-gray-900">
                  Match: {d.matches?.title || "Unknown Match"}
                </p>
                <p className="text-sm text-gray-600">{d.reason}</p>
                <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                  <span>Reporter: {d.reporter?.full_name || "Unknown"}</span>
                  <span>→</span>
                  <span>Reported: {d.reported?.full_name || "Unknown"}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    d.status === "open"
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {d.status}
                </span>

                {d.status === "open" && (
                  <button
                    onClick={() => handleResolve(d.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
