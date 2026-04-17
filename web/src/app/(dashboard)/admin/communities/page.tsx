"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ReasonModal from "@/components/ui/ReasonModal";

type CommunityStatus = "active" | "inactive" | "pending" | "rejected";

type Community = {
  id: string;
  owner_id: string;
  name: string;
  sport_type: string;
  member_count: number | null;
  status: CommunityStatus | string | null;
  created_at?: string;
  rejection_reason?: string | null;
  users?: {
    full_name: string | null;
    email?: string | null;
  } | null;
};

type EditFormData = {
  name: string;
  status: CommunityStatus;
};

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        active
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
        rejected
      </span>
    );
  }

  if (status === "inactive") {
    return (
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
        inactive
      </span>
    );
  }

  return (
    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
      pending
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminCommunitiesPage() {
  const router = useRouter();
  const { user, loading, isAdmin, isMainAdmin } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(
    null
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommunityId, setDeletingCommunityId] = useState<string | null>(
    null
  );
  const [reviewingCommunityId, setReviewingCommunityId] = useState<string | null>(
    null
  );
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CommunityStatus>("pending");

  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: "",
    status: "active",
  });

  const filteredCommunities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return communities.filter((community) => {
      const matchesSearch =
        !query ||
        community.name.toLowerCase().includes(query) ||
        (community.users?.full_name ?? "").toLowerCase().includes(query) ||
        (community.users?.email ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : community.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [communities, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      pending: communities.filter((c) => c.status === "pending").length,
      active: communities.filter((c) => c.status === "active").length,
      rejected: communities.filter((c) => c.status === "rejected").length,
      total: communities.length,
    };
  }, [communities]);

  useEffect(() => {
    if (!loading) {
      void loadPageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isAdmin, isMainAdmin]);

  const loadPageData = async () => {
    try {
      setPageLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!isAdmin) {
        router.push("/");
        return;
      }

      const { data: bannedUser, error: bannedError } = await supabase
        .from("users")
        .select("is_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (bannedError) {
        console.error(
          "Supabase error details:",
          bannedError?.message,
          bannedError?.details,
          bannedError?.hint
        );
        setErrorMessage("Failed to validate account status.");
        return;
      }

      if (bannedUser?.is_banned) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      const { data: communitiesData, error: communitiesError } = await supabase
        .from("communities")
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason"
        )
        .order("created_at", { ascending: false });

      if (communitiesError) {
        console.error(
          "Supabase error details:",
          communitiesError?.message,
          communitiesError?.details,
          communitiesError?.hint
        );
        setErrorMessage("Failed to load communities.");
        return;
      }

      const ownerIds = Array.from(
        new Set(
          ((communitiesData ?? []) as Array<{ owner_id: string }>).map(
            (community) => community.owner_id
          )
        )
      );

      let ownerMap = new Map<
        string,
        { full_name: string | null; email?: string | null }
      >();

      if (ownerIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", ownerIds);

        if (usersError) {
          console.error(
            "Supabase error details:",
            usersError?.message,
            usersError?.details,
            usersError?.hint
          );
          setErrorMessage("Failed to load community owners.");
          return;
        }

        ownerMap = new Map(
          ((usersData ?? []) as Array<{
            id: string;
            full_name: string | null;
            email?: string | null;
          }>).map((u) => [
            u.id,
            { full_name: u.full_name, email: u.email ?? null },
          ])
        );
      }

      const normalizedCommunities: Community[] = (
        (communitiesData ?? []) as Array<{
          id: string;
          owner_id: string;
          name: string;
          sport_type: string;
          member_count: number | null;
          status: string | null;
          created_at?: string;
          rejection_reason?: string | null;
        }>
      ).map((community) => ({
        ...community,
        users: ownerMap.get(community.owner_id) ?? null,
      }));

      setCommunities(normalizedCommunities);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while loading communities.");
    } finally {
      setPageLoading(false);
    }
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const startEdit = (community: Community) => {
    setErrorMessage("");
    setSuccessMessage("");
    setEditingCommunityId(community.id);
    setEditFormData({
      name: community.name,
      status:
        community.status === "active" ||
        community.status === "inactive" ||
        community.status === "pending" ||
        community.status === "rejected"
          ? community.status
          : "active",
    });
  };

  const cancelEdit = () => {
    setEditingCommunityId(null);
    setEditFormData({
      name: "",
      status: "active",
    });
  };

  const handleSaveEdit = async (communityId: string) => {
    try {
      setSavingEdit(true);
      setErrorMessage("");
      setSuccessMessage("");

      const trimmedName = editFormData.name.trim();

      if (!trimmedName) {
        setErrorMessage("Please enter the community name.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .update({
          name: trimmedName,
          status: editFormData.status,
        })
        .eq("id", communityId)
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason"
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to update community.");
        return;
      }

      const updatedCommunity = data as Community | null;

      if (updatedCommunity) {
        setCommunities((prev) =>
          prev.map((community) =>
            community.id === communityId
              ? {
                  ...updatedCommunity,
                  users:
                    prev.find((c) => c.id === communityId)?.users ?? null,
                }
              : community
          )
        );
      }

      setSuccessMessage("Community updated successfully.");
      cancelEdit();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while updating the community.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleApproveCommunity = async (communityId: string) => {
    try {
      setReviewingCommunityId(communityId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user || !isMainAdmin) {
        setErrorMessage("Only main admin can approve communities.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .update({
          status: "active",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", communityId)
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason"
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to approve community.");
        return;
      }

      const updatedCommunity = data as Community | null;

      if (updatedCommunity) {
        setCommunities((prev) =>
          prev.map((community) =>
            community.id === communityId
              ? {
                  ...updatedCommunity,
                  users:
                    prev.find((c) => c.id === communityId)?.users ?? null,
                }
              : community
          )
        );
      }

      setSuccessMessage("Community approved successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while approving the community.");
    } finally {
      setReviewingCommunityId(null);
      setApproveTargetId(null);
    }
  };

  const handleRejectCommunity = async (communityId: string, reason: string) => {
    try {
      setReviewingCommunityId(communityId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user || !isMainAdmin) {
        setErrorMessage("Only main admin can reject communities.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .update({
          status: "rejected",
          approved_by: null,
          approved_at: null,
          rejection_reason: reason.trim(),
        })
        .eq("id", communityId)
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason"
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to reject community.");
        return;
      }

      const updatedCommunity = data as Community | null;

      if (updatedCommunity) {
        setCommunities((prev) =>
          prev.map((community) =>
            community.id === communityId
              ? {
                  ...updatedCommunity,
                  users:
                    prev.find((c) => c.id === communityId)?.users ?? null,
                }
              : community
          )
        );
      }

      setSuccessMessage("Community rejected.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while rejecting the community.");
    } finally {
      setReviewingCommunityId(null);
      setRejectTargetId(null);
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    try {
      setDeletingCommunityId(communityId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId);

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to delete community.");
        return;
      }

      setCommunities((prev) =>
        prev.filter((community) => community.id !== communityId)
      );

      if (editingCommunityId === communityId) {
        cancelEdit();
      }

      setSuccessMessage("Community deleted successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while deleting the community.");
    } finally {
      setDeletingCommunityId(null);
      setDeleteTargetId(null);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading communities...</p>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Admin Communities</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review and manage community approval requests.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Rejected" value={stats.rejected} />
          <StatCard label="Total" value={stats.total} />
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">All Communities</h2>
              <p className="mt-1 text-sm text-gray-600">
                Pending requests are shown first by default.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search community or owner"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | CommunityStatus)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="pending">Pending</option>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="rejected">Rejected</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {filteredCommunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                No communities match your filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCommunities.map((community) => {
                const isEditing = editingCommunityId === community.id;
                const isReviewing = reviewingCommunityId === community.id;

                return (
                  <div
                    key={community.id}
                    className="rounded-2xl border p-5 transition hover:shadow-sm"
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold text-gray-900">
                            Edit Community
                          </h3>
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                            Editing
                          </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Community Name
                            </label>
                            <input
                              name="name"
                              type="text"
                              value={editFormData.name}
                              onChange={handleEditChange}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Status
                            </label>
                            <select
                              name="status"
                              value={editFormData.status}
                              onChange={handleEditChange}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                            >
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="rejected">Rejected</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(community.id)}
                            disabled={savingEdit}
                            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingEdit ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900">
                                {community.name}
                              </h3>
                              <StatusBadge status={community.status} />
                            </div>

                            <p className="text-sm text-gray-600">
                              Owner:{" "}
                              {community.users?.full_name ||
                                community.users?.email ||
                                "Unknown"}
                            </p>
                            {community.users?.email && (
                              <p className="mt-1 text-sm text-gray-500">
                                {community.users.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-1 text-sm text-gray-600">
                          <p>Sport: {community.sport_type}</p>
                          <p>Members: {community.member_count ?? 0}</p>
                          {community.created_at && (
                            <p>
                              Created:{" "}
                              {new Date(community.created_at).toLocaleDateString()}
                            </p>
                          )}
                          {community.status === "rejected" &&
                            community.rejection_reason && (
                              <p className="text-red-600">
                                Rejection reason: {community.rejection_reason}
                              </p>
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(community)}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          {isMainAdmin && community.status === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setApproveTargetId(community.id)}
                                disabled={isReviewing}
                                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isReviewing ? "Working..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTargetId(community.id)}
                                disabled={isReviewing}
                                className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isReviewing ? "Working..." : "Reject"}
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(community.id)}
                            disabled={deletingCommunityId === community.id}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingCommunityId === community.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!approveTargetId}
        title="Approve Community"
        description="Approve this community and make it available for match assignment?"
        confirmLabel="Approve"
        confirmVariant="success"
        loading={reviewingCommunityId === approveTargetId}
        onCancel={() => setApproveTargetId(null)}
        onConfirm={() => {
          if (approveTargetId) {
            void handleApproveCommunity(approveTargetId);
          }
        }}
      />

      <ReasonModal
        open={!!rejectTargetId}
        title="Reject Community"
        description="Provide a reason for rejecting this community."
        confirmLabel="Reject"
        loading={reviewingCommunityId === rejectTargetId}
        onCancel={() => setRejectTargetId(null)}
        onConfirm={(reason) => {
          if (rejectTargetId) {
            void handleRejectCommunity(rejectTargetId, reason);
          }
        }}
      />

      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Community"
        description="Are you sure you want to delete this community?"
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingCommunityId === deleteTargetId}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            void handleDeleteCommunity(deleteTargetId);
          }
        }}
      />
    </>
  );
}