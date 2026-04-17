"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

type OrganizerStats = {
  totalCommunities: number;
  pendingCommunities: number;
  activeCommunities: number;
  totalMatches: number;
  publicMatches: number;
};

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-900">{value}</p>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

function QuickCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </Link>
  );
}

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const {
    user,
    roles,
    loading,
    isOrganizer,
    isAdmin,
    isMainAdmin,
    verificationStatus,
  } = useAuth();

  const [stats, setStats] = useState<OrganizerStats>({
    totalCommunities: 0,
    pendingCommunities: 0,
    activeCommunities: 0,
    totalMatches: 0,
    publicMatches: 0,
  });
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const canManageMatches = isAdmin || isMainAdmin || isOrganizer;
  const isApprovedOrganizerOnly = isOrganizer && !isAdmin && !isMainAdmin;

  useEffect(() => {
    if (!loading) {
      void loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, roles, isOrganizer, isAdmin, isMainAdmin, verificationStatus]);

  const loadStats = async () => {
    try {
      setErrorMessage("");

      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!canManageMatches) {
        router.push("/");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        setPageLoading(false);
        return;
      }

      const [
        { count: totalCommunities, error: totalCommunitiesError },
        { count: pendingCommunities, error: pendingCommunitiesError },
        { count: activeCommunities, error: activeCommunitiesError },
        { count: totalMatches, error: totalMatchesError },
        { count: publicMatches, error: publicMatchesError },
      ] = await Promise.all([
        supabase
          .from("communities")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("communities")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("communities")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "active"),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user.id),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user.id)
          .is("community_id", null),
      ]);

      const firstError =
        totalCommunitiesError ||
        pendingCommunitiesError ||
        activeCommunitiesError ||
        totalMatchesError ||
        publicMatchesError;

      if (firstError) {
        console.error(
          "Supabase error details:",
          firstError?.message,
          firstError?.details,
          firstError?.hint
        );
        setErrorMessage("Failed to load organizer dashboard statistics.");
        return;
      }

      setStats({
        totalCommunities: totalCommunities ?? 0,
        pendingCommunities: pendingCommunities ?? 0,
        activeCommunities: activeCommunities ?? 0,
        totalMatches: totalMatches ?? 0,
        publicMatches: publicMatches ?? 0,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage(
        "Something went wrong while loading the organizer dashboard."
      );
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading organizer dashboard...</p>
      </div>
    );
  }

  if (!user) return null;
  if (!canManageMatches) return null;

  if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Organizer Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Your organizer access is not active yet.
          </p>
        </div>

        {verificationStatus === "pending" && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
            Your organizer application is under review.
          </div>
        )}

        {verificationStatus === "rejected" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            Your organizer application was rejected.
          </div>
        )}

        {!verificationStatus && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
            No organizer verification record was found yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Organizer Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your communities, approvals, and matches.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Communities"
          value={stats.totalCommunities}
          href="/organizer/communities"
        />
        <StatCard
          label="Pending Communities"
          value={stats.pendingCommunities}
          href="/organizer/communities"
        />
        <StatCard
          label="Active Communities"
          value={stats.activeCommunities}
          href="/organizer/communities"
        />
        <StatCard
          label="Total Matches"
          value={stats.totalMatches}
          href="/organizer/matches"
        />
        <StatCard
          label="Public Matches"
          value={stats.publicMatches}
          href="/organizer/matches"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickCard
          title="My Communities"
          description="Create communities and send them for approval."
          href="/organizer/communities"
        />
        <QuickCard
          title="My Matches"
          description="Create public or community-linked matches."
          href="/organizer/matches"
        />
        <QuickCard
          title="Profile"
          description="View account details and sign out."
          href="/profile"
        />
      </div>
    </div>
  );
}