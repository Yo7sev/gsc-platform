"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthContext";

export default function DashboardHomePage() {
  const { user, loading, isMainAdmin, isAdmin, roles } = useAuth();

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Welcome</h1>
          <p className="mt-2 text-sm text-gray-600">
            Please log in to continue.
          </p>

          <div className="mt-4">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasOrganizerRole = roles.includes("organizer");

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose where you want to go.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(isMainAdmin || isAdmin) && (
            <Link
              href="/admin"
              className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
              <p className="mt-2 text-sm text-gray-600">
                Manage verifications, communities, matches, and users.
              </p>
            </Link>
          )}

          {hasOrganizerRole && (
            <Link
              href="/organizer"
              className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-lg font-bold text-gray-900">
                Organizer Panel
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Manage your communities and matches.
              </p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}