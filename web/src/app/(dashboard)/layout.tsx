"use client";

import { useAuth } from "@/components/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isMainAdmin, isAdmin, isOrganizer } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const showAdminSidebar = isMainAdmin || isAdmin;
  const showOrganizerSidebar = !showAdminSidebar && isOrganizer;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {showAdminSidebar && <AdminSidebar isMainAdmin={isMainAdmin} />}
      {showOrganizerSidebar && (
        <OrganizerSidebar isAdmin={isAdmin} isMainAdmin={isMainAdmin} />
      )}
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}

function AdminSidebar({ isMainAdmin }: { isMainAdmin: boolean }) {
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", href: "/admin" },
    { label: "Organizer Verifications", href: "/admin/verification" },
    {
      label: isMainAdmin ? "Community Approvals" : "Communities",
      href: "/admin/communities",
    },
    { label: "Matches", href: "/admin/matches" },
    { label: "Disputes", href: "/admin/disputes" },
    { label: "Profile", href: "/profile" },
  ];

  return (
    <aside className="w-72 border-r border-gray-200 bg-white p-6">
      <div className="mb-8">
        <h1 className="text-xl font-black text-gray-900">GSC Platform</h1>
        <p className="mt-1 text-sm text-gray-500">Admin Workspace</p>
      </div>

      {isMainAdmin ? (
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
            Main Admin
          </p>
          <p className="mt-1 text-sm text-yellow-800">
            You can approve or reject pending communities.
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Admin Access
          </p>
          <p className="mt-1 text-sm text-gray-700">
            You can review communities, but only main admin can approve them.
          </p>
        </div>
      )}

      <nav className="space-y-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function OrganizerSidebar({
  isAdmin,
  isMainAdmin,
}: {
  isAdmin: boolean;
  isMainAdmin: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", href: "/organizer" },
    { label: "Communities", href: "/organizer/communities" },
    { label: "Matches", href: "/organizer/matches" },
    { label: "Profile", href: "/profile" },
  ];

  return (
    <aside className="w-72 border-r border-gray-200 bg-white p-6">
      <div className="mb-8">
        <h1 className="text-xl font-black text-gray-900">GSC Platform</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin || isMainAdmin
            ? "Organizer & Admin Workspace"
            : "Organizer Workspace"}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Community Flow
        </p>
        <p className="mt-1 text-sm text-blue-800">
          New communities need main admin approval. Matches can be public or
          linked to an active community.
        </p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/organizer" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}