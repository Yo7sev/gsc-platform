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
  city: string | null;
  location_name: string | null;
  member_count: number | null;
  status: CommunityStatus | string | null;
  created_at?: string;
  rejection_reason?: string | null;
};

type EditFormData = {
  name: string;
  sport_type: string;
  city: string;
  location_name: string;
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
    null
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommunityId, setDeletingCommunityId] = useState<string | null>(
    null
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
    city: "",
    location_name: "",
  });

  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: "",
    sport_type: "Football",
    city: "",
    location_name: "",
  });

  useEffect(() => {
    if (!loading) {
      void loadPageData();
    }
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
          "id, owner_id, name, sport_type, city, location_name, member_count, status, created_at, rejection_reason"
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage("Failed to load communities.");
        return;
      }

      setCommunities((data as Community[]) || []);
    } catch (error) {
      setErrorMessage("Something went wrong while loading communities.");
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sport_type: "Football",
      city: "",
      location_name: "",
    });
  };

  const startEdit = (community: Community) => {
    setErrorMessage("");
    setSuccessMessage("");
    setEditingCommunityId(community.id);
    setEditFormData({
      name: community.name,
      sport_type: community.sport_type || "Football",
      city: community.city || "",
      location_name: community.location_name || "",
    });
  };

  const cancelEdit = () => {
    setEditingCommunityId(null);
    setEditFormData({
      name: "",
      sport_type: "Football",
      city: "",
      location_name: "",
    });
  };

  const handleCreateCommunity = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) return;

      const trimmedName = formData.name.trim();
      const trimmedCity = formData.city.trim();
      const trimmedLocation = formData.location_name.trim();

      if (!trimmedName || !trimmedCity || !trimmedLocation) {
        setErrorMessage("Please fill in all required fields (Name, City, and Location).");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .insert([
          {
            owner_id: user.id,
            name: trimmedName,
            sport_type: "Football",
            city: trimmedCity,
            location_name: trimmedLocation,
            member_count: 0,
            status: "pending",
          },
        ])
        .select(
          "id, owner_id, name, sport_type, city, location_name, member_count, status, created_at, rejection_reason"
        )
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message || "Failed to create community.");
        return;
      }

      if (data) setCommunities((prev) => [data as Community, ...prev]);

      setSuccessMessage("Community created successfully and sent for approval.");
      resetForm();
    } catch (error) {
      setErrorMessage("Something went wrong while creating the community.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (communityId: string) => {
    try {
      setSavingEdit(true);
      setErrorMessage("");

      const trimmedName = editFormData.name.trim();
      const trimmedCity = editFormData.city.trim();
      const trimmedLocation = editFormData.location_name.trim();

      if (!trimmedName || !trimmedCity || !trimmedLocation) {
        setErrorMessage("Name, City, and Location cannot be empty.");
        return;
      }

      const { data, error } = await supabase
        .from("communities")
        .update({
          name: trimmedName,
          city: trimmedCity,
          location_name: trimmedLocation,
          status: "pending",
          rejection_reason: null,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", communityId)
        .eq("owner_id", user!.id)
        .select(
          "id, owner_id, name, sport_type, city, location_name, member_count, status, created_at, rejection_reason"
        )
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message || "Failed to update community.");
        return;
      }

      if (data) {
        setCommunities((prev) =>
          prev.map((c) => (c.id === communityId ? (data as Community) : c))
        );
      }

      setSuccessMessage("Community updated and re-submitted for approval.");
      cancelEdit();
    } catch (error) {
      setErrorMessage("Something went wrong while updating.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    if (!window.confirm("Are you sure you want to delete this community?")) return;
    try {
      setDeletingCommunityId(communityId);
      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId)
        .eq("owner_id", user!.id);

      if (error) throw error;
      setCommunities((prev) => prev.filter((c) => c.id !== communityId));
      setSuccessMessage("Community deleted successfully.");
    } catch (error) {
      setErrorMessage("Failed to delete community.");
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

  if (!user || !canManageCommunities) return null;

  if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
          <p className="mt-2 text-sm text-gray-600">You need approved organizer access before creating communities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
      </div>

      {errorMessage && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}
      {successMessage && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{successMessage}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* CREATE FORM */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Create Community</h2>
            <form onSubmit={handleCreateCommunity} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Community Name</label>
                <input name="name" type="text" value={formData.name} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
                <input name="city" type="text" value={formData.city} onChange={handleChange} placeholder="e.g. Irbid, Amman" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Location Name</label>
                <input name="location_name" type="text" value={formData.location_name} onChange={handleChange} placeholder="e.g. Downtown Court" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black" required />
              </div>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                {submitting ? "Creating..." : "Create Community"}
              </button>
            </form>
          </div>
        </div>

        {/* LIST */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {communities.length === 0 ? (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-gray-500">No communities yet.</p>
              </div>
            ) : (
              communities.map((community) => {
                const isEditing = editingCommunityId === community.id;
                return (
                  <div key={community.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                    {isEditing ? (
                      <div className="space-y-4">
                        <input name="name" type="text" value={editFormData.name} onChange={handleEditChange} className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm" placeholder="Name" />
                        <input name="city" type="text" value={editFormData.city} onChange={handleEditChange} className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm" placeholder="City" />
                        <input name="location_name" type="text" value={editFormData.location_name} onChange={handleEditChange} className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm" placeholder="Location" />
                        <div className="flex gap-3">
                          <button onClick={() => void handleSaveEdit(community.id)} disabled={savingEdit} className="rounded-xl bg-black px-4 py-2 text-sm text-white">Save</button>
                          <button onClick={cancelEdit} className="rounded-xl border border-gray-300 px-4 py-2 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{community.name}</h3>
                            <p className="text-sm text-gray-600">{community.city} - {community.location_name}</p>
                          </div>
                          <StatusBadge status={community.status} />
                        </div>
                        <div className="mt-5 flex gap-3">
                          <button onClick={() => startEdit(community)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm">Edit</button>
                          <button onClick={() => void handleDeleteCommunity(community.id)} className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white">Delete</button>
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