"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

type CommunityStatus = "pending" | "active" | "rejected";

type Community = {
  id: string;
  owner_id: string;
  name: string;
  sport_type: string;
  member_count: number | null;
  status: CommunityStatus | string | null;
  created_at?: string;
  rejection_reason?: string | null;
};

type EditFormData = {
  name: string;
  sport_type: string;
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

  return (
    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
      pending approval
    </span>
  );
}

export default function OrganizerCommunitiesPage() {
  const router = useRouter();
  const {
    user,
    loading,
    roles,
    isOrganizer,
    isAdmin,
    isMainAdmin,
    verificationStatus,
  } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(
    null,
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommunityId, setDeletingCommunityId] = useState<string | null>(
    null,
  );

  const canManageCommunities = useMemo(() => {
    return isMainAdmin || isAdmin || isOrganizer;
  }, [isMainAdmin, isAdmin, isOrganizer]);

  const isApprovedOrganizerOnly = useMemo(() => {
    return isOrganizer && !isAdmin && !isMainAdmin;
  }, [isOrganizer, isAdmin, isMainAdmin]);

  const [formData, setFormData] = useState({
    name: "",
    sport_type: "Football",
  });

  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: "",
    sport_type: "Football",
  });

  useEffect(() => {
    if (!loading) {
      void loadPageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    user,
    roles,
    isOrganizer,
    isAdmin,
    isMainAdmin,
    verificationStatus,
  ]);

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

      if (!canManageCommunities) {
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
          bannedError?.hint,
        );
        setErrorMessage("Failed to validate account status.");
        return;
      }

      if (bannedUser?.is_banned) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint,
        );
        setErrorMessage("Failed to load communities.");
        return;
      }

      setCommunities((data as Community[]) || []);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while loading communities.");
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sport_type: "Football",
    });
  };

  const startEdit = (community: Community) => {
    setErrorMessage("");
    setSuccessMessage("");
    setEditingCommunityId(community.id);
    setEditFormData({
      name: community.name,
      sport_type: community.sport_type || "Football",
    });
  };

  const cancelEdit = () => {
    setEditingCommunityId(null);
    setEditFormData({
      name: "",
      sport_type: "Football",
    });
  };

  const handleCreateCommunity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canManageCommunities) {
        setErrorMessage("You do not have access to create communities.");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        setErrorMessage("Only approved organizers can create communities.");
        return;
      }

      const trimmedName = formData.name.trim();

      if (!trimmedName) {
        setErrorMessage("Please enter the community name.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .insert([
          {
            owner_id: user.id,
            name: trimmedName,
            sport_type: "Football",
            member_count: 0,
            status: "pending",
          },
        ])
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason",
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint,
        );
        setErrorMessage(error.message || "Failed to create community.");
        return;
      }

      const createdCommunity = data as Community | null;

      if (createdCommunity) {
        setCommunities((prev) => [createdCommunity, ...prev]);
      }

      setSuccessMessage(
        "Community created successfully and sent for main admin approval.",
      );
      resetForm();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while creating the community.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (communityId: string) => {
    try {
      setSavingEdit(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canManageCommunities) {
        setErrorMessage("You do not have access to edit communities.");
        return;
      }

      const trimmedName = editFormData.name.trim();

      if (!trimmedName) {
        setErrorMessage("Please enter the community name.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .update({
          name: trimmedName,
          sport_type: "Football",
          status: "pending",
          rejection_reason: null,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", communityId)
        .eq("owner_id", user.id)
        .select(
          "id, owner_id, name, sport_type, member_count, status, created_at, rejection_reason",
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint,
        );
        setErrorMessage(error.message || "Failed to update community.");
        return;
      }

      const updatedCommunity = data as Community | null;

      if (updatedCommunity) {
        setCommunities((prev) =>
          prev.map((community) =>
            community.id === communityId ? updatedCommunity : community,
          ),
        );
      }

      setSuccessMessage(
        "Community updated and re-submitted for main admin approval.",
      );
      cancelEdit();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while updating the community.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this community?",
    );

    if (!confirmed) return;

    try {
      setDeletingCommunityId(communityId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canManageCommunities) {
        setErrorMessage("You do not have access to delete communities.");
        return;
      }

      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId)
        .eq("owner_id", user.id);

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint,
        );
        setErrorMessage(error.message || "Failed to delete community.");
        return;
      }

      setCommunities((prev) =>
        prev.filter((community) => community.id !== communityId),
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
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading communities...</p>
      </div>
    );
  }

  if (!user) return null;
  if (!canManageCommunities) return null;

  if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
          <p className="mt-2 text-sm text-gray-600">
            You need approved organizer access before creating communities.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">
            Verification Status
          </h2>
          <p className="mt-2 text-sm text-yellow-800">
            {verificationStatus === "pending" &&
              "Your organizer request is still pending review."}
            {verificationStatus === "rejected" &&
              "Your organizer request was rejected. Please update your submission and try again."}
            {!verificationStatus &&
              "No verification request was found for your account yet."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create communities and send them for main admin approval.
        </p>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Create Community
            </h2>

            <form onSubmit={handleCreateCommunity} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Community Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Example: Downtown Football Club"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Sport Type
                </label>
                <input
                  type="text"
                  value="Football"
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Community"}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-4">
            {communities.length === 0 ? (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-gray-500">
                  No communities yet. Create your first one.
                </p>
              </div>
            ) : (
              communities.map((community) => {
                const isEditing = editingCommunityId === community.id;

                return (
                  <div
                    key={community.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
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
                              Sport Type
                            </label>
                            <input
                              type="text"
                              value="Football"
                              disabled
                              className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600 outline-none"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                          Saving changes will send this community for main admin
                          review again.
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
                            <h3 className="text-base font-semibold text-gray-900">
                              {community.name}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                              Sport: {community.sport_type || "Football"}
                            </p>
                          </div>

                          <StatusBadge status={community.status} />
                        </div>

                        <div className="mt-4 space-y-1 text-sm text-gray-600">
                          <p>Members: {community.member_count ?? 0}</p>
                          {community.created_at && (
                            <p>
                              Created:{" "}
                              {new Date(
                                community.created_at,
                              ).toLocaleDateString()}
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
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteCommunity(community.id)
                            }
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
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
