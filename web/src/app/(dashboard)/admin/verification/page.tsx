"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

interface VerificationUser {
  full_name: string | null;
  email: string;
}

interface VerificationRequest {
  id: string;
  user_id: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason?: string;
  document_url: string | null;
  users: VerificationUser | null;
}

interface ManagedUser {
  id: string;
  user_id: string;
  role: string;
  users: VerificationUser | null;
  is_banned: boolean;
  document_url: string | null;
}

type Tab = "verifications" | "users";

type RawVerificationRow = {
  id: string;
  user_id: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason?: string;
  document_url: string | null;
  users?: VerificationUser[] | VerificationUser | null;
};

type RoleRow = {
  user_id: string;
  role: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
  is_banned: boolean;
};

type VerRow = {
  user_id: string;
  document_url: string | null;
  status: string;
  created_at: string;
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    main_admin: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    organizer: "bg-emerald-100 text-emerald-700 border-emerald-200",
    player: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[role] || "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  variant = "gray",
}: {
  label: string;
  onClick: () => void;
  variant?: "blue" | "green" | "red" | "gray";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    green:
      "bg-green-600 text-white border-green-600 hover:bg-green-700 hover:border-green-700",
    red: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    gray: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${styles[variant]}`}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: number;
  valueColor: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueColor}`}>{value}</p>
    </div>
  );
}

function buildVerificationFileUrl(pathOrUrl: string | null) {
  if (!pathOrUrl) return null;

  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/verification-docs/${pathOrUrl}`;
}

export default function VerificationPage() {
  const { isAdmin, isMainAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("verifications");
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void loadVerifications();
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (tab === "users" && isMainAdmin) {
      void loadUsers();
    }
  }, [tab, isMainAdmin]);

  const loadVerifications = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("verifications")
        .select(
          "id, user_id, role, status, document_url, rejection_reason, created_at, users!verifications_user_id_fkey(full_name, email)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized: VerificationRequest[] = (
        (data || []) as RawVerificationRow[]
      ).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        rejection_reason: row.rejection_reason,
        document_url: row.document_url,
        users: Array.isArray(row.users)
          ? (row.users[0] ?? null)
          : (row.users ?? null),
      }));

      setVerifications(normalized);
    } catch (err) {
      console.error("Error loading verifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["main_admin", "admin", "organizer", "player"])
        .order("role");

      if (roleError) throw roleError;

      const roleRows = (roleData || []) as RoleRow[];
      const userIds = Array.from(new Set(roleRows.map((r) => r.user_id)));

      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email, is_banned")
        .in("id", userIds);

      if (userError) throw userError;

      const { data: verData, error: verError } = await supabase
        .from("verifications")
        .select("user_id, document_url, status, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false });

      if (verError) throw verError;

      const userMap = new Map(
        ((userData || []) as UserRow[]).map((u) => [u.id, u]),
      );

      const verMap = new Map<string, VerRow>();
      ((verData || []) as VerRow[]).forEach((v) => {
        if (!verMap.has(v.user_id)) {
          verMap.set(v.user_id, v);
        }
      });

      const rolePriority = ["main_admin", "admin", "organizer", "player"];

      const grouped = new Map<string, string[]>();
      roleRows.forEach((r) => {
        if (!grouped.has(r.user_id)) grouped.set(r.user_id, []);
        grouped.get(r.user_id)?.push(r.role);
      });

      const mapped: ManagedUser[] = Array.from(grouped.entries()).map(
        ([user_id, roles]) => {
          const u = userMap.get(user_id);
          const v = verMap.get(user_id);

          const highestRole =
            rolePriority.find((role) => roles.includes(role)) || roles[0];

          return {
            id: user_id,
            user_id,
            role: highestRole,
            users: u ? { full_name: u.full_name, email: u.email } : null,
            is_banned: u?.is_banned ?? false,
            document_url: v?.document_url ?? null,
          };
        },
      );

      setUsers(mapped);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const handleApprove = async (id: string, uid: string) => {
    try {
      const { error: verificationError } = await supabase
        .from("verifications")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (verificationError) throw verificationError;

      const { data: existingOrganizer, error: roleCheckError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", uid)
        .eq("role", "organizer")
        .maybeSingle();

      if (roleCheckError) throw roleCheckError;

      if (!existingOrganizer) {
        const { error: insertRoleError } = await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: "organizer" });

        if (insertRoleError) throw insertRoleError;
      }

      await loadVerifications();
      if (tab === "users" && isMainAdmin) await loadUsers();
    } catch (err) {
      console.error("Approval failed:", err);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const { error } = await supabase
        .from("verifications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await loadVerifications();
    } catch (err) {
      console.error("Rejection failed:", err);
    }
  };

  const handleBan = async (userId: string, currentBanned: boolean) => {
    const action = currentBanned ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ is_banned: !currentBanned })
        .eq("id", userId);

      if (error) throw error;

      await loadUsers();
    } catch (err) {
      console.error("Ban action failed:", err);
    }
  };

  const handlePromote = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "organizer" : "admin";
    const action =
      currentRole === "admin" ? "demote to Organizer" : "promote to Admin";

    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("role", currentRole);

      if (error) throw error;

      await loadUsers();
    } catch (err) {
      console.error("Promote action failed:", err);
    }
  };

  const handleMakePlayer = async (userId: string, currentRole: string) => {
    const action =
      currentRole === "admin"
        ? "remove Admin and keep as Player"
        : "remove Organizer and keep as Player";

    if (!confirm(`Are you sure you want to ${action}?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", currentRole);

      if (deleteError) throw deleteError;

      const { data: existingPlayer, error: checkError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "player")
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingPlayer) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "player" });

        if (insertError) throw insertError;
      }

      await loadUsers();
    } catch (err) {
      console.error("Make player action failed:", err);
    }
  };

  if (authLoading || loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  if (!isAdmin) {
    return <div className="font-medium text-red-600">Access denied</div>;
  }

  const pendingCount = verifications.filter(
    (v) => v.status === "pending",
  ).length;
  const approvedCount = verifications.filter(
    (v) => v.status === "approved",
  ).length;
  const rejectedCount = verifications.filter(
    (v) => v.status === "rejected",
  ).length;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-600">
            Admin Workspace
          </p>
          <h1 className="text-3xl font-black text-gray-900">
            Verification & User Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Review organizer requests, manage roles, and control account access.
          </p>
        </div>
      </div>

      <div className="mb-8 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("verifications")}
          className={`rounded-t-xl px-5 py-3 text-sm font-semibold transition-colors ${
            tab === "verifications"
              ? "-mb-px border border-b-white border-gray-200 bg-white text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Organizer Verifications
        </button>

        {isMainAdmin && (
          <button
            onClick={() => setTab("users")}
            className={`rounded-t-xl px-5 py-3 text-sm font-semibold transition-colors ${
              tab === "users"
                ? "-mb-px border border-b-white border-gray-200 bg-white text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            User Management
          </button>
        )}
      </div>

      {tab === "verifications" && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatCard
              label="Pending Requests"
              value={pendingCount}
              valueColor="text-yellow-600"
            />
            <StatCard
              label="Approved Requests"
              value={approvedCount}
              valueColor="text-green-600"
            />
            <StatCard
              label="Rejected Requests"
              value={rejectedCount}
              valueColor="text-red-600"
            />
          </div>

          {verifications.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-500 shadow-sm">
              No verification requests.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {verifications.map((v) => {
                const fileUrl = buildVerificationFileUrl(v.document_url);

                return (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-gray-900">
                          {v.users?.full_name || "Unknown"}
                        </p>
                        <p className="truncate text-sm text-gray-500">
                          {v.users?.email || "No email"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <RoleBadge role={v.role} />
                          <StatusBadge status={v.status} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-gray-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Documents
                      </p>

                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          📄 View CV
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400">No CV uploaded</p>
                      )}

                      {v.rejection_reason && (
                        <p className="mt-3 text-sm italic text-red-500">
                          Reason: {v.rejection_reason}
                        </p>
                      )}
                    </div>

                    {v.status === "pending" && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <ActionButton
                          label="Approve"
                          variant="green"
                          onClick={() => handleApprove(v.id, v.user_id)}
                        />
                        <ActionButton
                          label="Reject"
                          variant="red"
                          onClick={() => handleReject(v.id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "users" && isMainAdmin && (
        <>
          {users.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-500 shadow-sm">
              No users found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {users.map((u) => {
                const fileUrl = buildVerificationFileUrl(u.document_url);

                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold text-gray-900">
                            {u.users?.full_name || "Unknown"}
                          </p>
                          {u.is_banned && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                              BANNED
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-sm text-gray-500">
                          {u.users?.email || "No email"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <RoleBadge role={u.role} />
                        </div>

                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
                          >
                            📄 View CV
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(u.role === "organizer" || u.role === "admin") && (
                          <>
                            <ActionButton
                              label={
                                u.role === "admin"
                                  ? "Demote to Organizer"
                                  : "Promote to Admin"
                              }
                              variant="blue"
                              onClick={() => handlePromote(u.user_id, u.role)}
                            />

                            <ActionButton
                              label={
                                u.role === "admin"
                                  ? "Remove Admin"
                                  : "Remove Organizer"
                              }
                              variant="gray"
                              onClick={() =>
                                handleMakePlayer(u.user_id, u.role)
                              }
                            />
                          </>
                        )}

                        <ActionButton
                          label={u.is_banned ? "Unban" : "Ban"}
                          variant={u.is_banned ? "green" : "red"}
                          onClick={() => handleBan(u.user_id, u.is_banned)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
