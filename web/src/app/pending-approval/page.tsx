"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { user, roles, loading, isAdmin, isOrganizer, verificationStatus } =
    useAuth();
  const [dismissed, setDismissed] = useState(false);

  const showPendingModal =
    !loading &&
    !dismissed &&
    !!user &&
    (roles as string[]).includes("organizer") &&
    verificationStatus === "pending";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pending Approval Modal */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">📬</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Application Submitted!
            </h2>
            <p className="text-gray-500 text-sm mb-2">
              Your organizer application has been received and is currently
              under review by our team.
            </p>
            <p className="text-gray-500 text-sm mb-4">
              You will receive an email once your account has been approved.
              This usually takes 1–2 business days.
            </p>
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl mb-6">
              <p className="text-green-700 text-sm font-medium">
                ✅ Your CV has been uploaded successfully
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDismissed(true)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Got it
              </button>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-extrabold text-gray-900">GSC Platform</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome,{" "}
              <span className="font-semibold text-gray-900">
                {user?.full_name || "User"}
              </span>
            </span>
            <div className="flex gap-2">
              {roles.map((r) => (
                <span
                  key={r}
                  className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase"
                >
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm mb-1">Average Rating</p>
            <p className="text-3xl font-black text-gray-900">
              {user?.average_rating ? `${user.average_rating}/5` : "—"}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm mb-1">Roles</p>
            <p className="text-3xl font-black text-gray-900">{roles.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm mb-1">Member Since</p>
            <p className="text-3xl font-black text-gray-900">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>

        {/* Rejected notice */}
        {(roles as string[]).includes("organizer") &&
          verificationStatus === "rejected" && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium">
              ❌ Your organizer application was rejected. Please contact support
              for more information.
            </div>
          )}

        {isAdmin && (
          <div className="mb-10">
            <h3 className="text-lg font-extrabold text-gray-900 mb-4">
              Admin Panel
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DashCard
                title="Operations"
                description="Platform health & stats"
                href="/admin/operations"
              />
              <DashCard
                title="Verification"
                description="Review applications"
                href="/admin/verification"
              />
              <DashCard
                title="Disputes"
                description="Resolve disputes"
                href="/admin/disputes"
              />
              <DashCard
                title="Communities"
                description="Manage match events"
                href="/admin/communities"
              />
            </div>
          </div>
        )}

        {isOrganizer && (
          <div className="mb-10">
            <h3 className="text-lg font-extrabold text-gray-900 mb-4">
              Organizer Panel
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DashCard
                title="Create Match"
                description="Set up a new match"
                href="/organizer/create-match"
              />
              <DashCard
                title="My Matches"
                description="View your matches"
                href="/organizer/matches"
              />
              <DashCard
                title="My Communities"
                description="Create & manage communities"
                href="/organizer/communities"
              />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-4">Player</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashCard
              title="Browse Matches"
              description="Find & join matches"
              href="/matches"
            />
            <DashCard
              title="My Bookings"
              description="Your booked matches"
              href="/bookings"
            />
            <DashCard
              title="Ratings"
              description="Your ratings & reviews"
              href="/ratings"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function DashCard({
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
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all block"
    >
      <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
      <p className="text-gray-400 text-sm">{description}</p>
    </Link>
  );
}
