"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

function formatRole(role: string) {
  return role.replace("_", " ");
}

function getRoleBadgeStyles(role: string) {
  const styles: Record<string, string> = {
    main_admin: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    organizer: "bg-emerald-100 text-emerald-700 border-emerald-200",
    player: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return styles[role] || "bg-gray-100 text-gray-700 border-gray-200";
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "U";
  const parts = source.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-4 last:border-b-0">
      <p className="min-w-140px text-sm font-medium text-gray-500">{label}</p>
      <p className="wrap-break-words text-right text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    roles,
    loading,
    isAdmin,
    isMainAdmin,
    isOrganizer,
    verificationStatus,
  } = useAuth();

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "N/A";

  const averageRating =
    user?.average_rating == null
      ? "N/A"
      : Number(user.average_rating).toFixed(1);

  const initials = getInitials(user?.full_name, user?.email);

  const primaryRole = roles.includes("main_admin")
    ? "main_admin"
    : roles.includes("admin")
    ? "admin"
    : roles.includes("organizer")
    ? "organizer"
    : roles.includes("player")
    ? "player"
    : "player";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-20 bg-linear-to-r from-green-600 via-emerald-500 to-teal-500" />

        <div className="px-6 pb-6">
          <div className="-mt-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-black text-xl font-black text-white shadow-lg">
                {initials}
              </div>

              <div>
                <h1 className="text-2xl font-black text-gray-900">
                  {user.full_name || "User Profile"}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {user.email || "No email"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeStyles(
                        role
                      )}`}
                    >
                      {formatRole(role)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="self-start rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 md:self-end"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Primary Role" value={formatRole(primaryRole)} />
        <StatCard label="Joined" value={joinedDate} />
        <StatCard label="Average Rating" value={averageRating} />
        <StatCard label="Verification" value={verificationStatus || "N/A"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your personal account details.
          </p>

          <div className="mt-4">
            <InfoRow label="Full Name" value={user.full_name || "N/A"} />
            <InfoRow label="Email" value={user.email || "N/A"} />
            <InfoRow label="Joined Date" value={joinedDate} />
            <InfoRow label="Average Rating" value={averageRating} />
            <InfoRow
              label="Account Status"
              value={user.is_banned ? "Banned" : "Active"}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Access & Permissions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your current platform access level.
          </p>

          <div className="mt-4">
            <InfoRow
              label="Main Admin Access"
              value={isMainAdmin ? "Enabled" : "No"}
            />
            <InfoRow label="Admin Access" value={isAdmin ? "Enabled" : "No"} />
            <InfoRow
              label="Approved Organizer"
              value={isOrganizer ? "Yes" : "No"}
            />
            <InfoRow
              label="Verification Status"
              value={verificationStatus || "N/A"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-linear-to-r from-gray-900 to-gray-800 p-6 text-white shadow-sm">
        <h2 className="text-lg font-bold">Session & Security</h2>
        <p className="mt-2 text-sm text-gray-300">
          You are currently signed in to the GSC Platform dashboard.
        </p>

        <button
          onClick={handleSignOut}
          className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:opacity-90"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}