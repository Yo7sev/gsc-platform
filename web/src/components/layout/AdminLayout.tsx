"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get("tab");

  const items = [
    { label: "Dashboard", href: "/admin" },
    { label: "Verification", href: "/admin/verification" },
    { label: "Users", href: "/admin/verification?tab=users" },
    { label: "Communities", href: "/admin/communities" },
    { label: "Disputes", href: "/admin/disputes" },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    if (href === "/admin/verification") {
      return pathname === "/admin/verification" && currentTab !== "users";
    }

    if (href === "/admin/verification?tab=users") {
      return pathname === "/admin/verification" && currentTab === "users";
    }

    return pathname === href;
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 p-6">
      <div className="mb-8">
        <h1 className="text-xl font-black text-gray-900">GSC Platform</h1>
        <p className="text-sm text-gray-500 mt-1">Admin Workspace</p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 rounded-xl text-sm font-semibold transition ${
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
