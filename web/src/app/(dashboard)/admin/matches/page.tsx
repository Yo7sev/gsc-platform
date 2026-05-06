"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";

type MatchStatus = "open" | "full" | "cancelled";

type MatchRow = {
  id: string;
  organizer_id: string;
  community_id: string | null;
  title: string;
  location: string;
  scheduled_at: string;
  formation_type: string | null;
  booking_logic: string | null;
  position_enabled: boolean | null;
  max_players: number;
  price: number | null;
  status: MatchStatus | string;
  created_at?: string;
  google_maps_url?: string | null;
  image_urls?: string[] | null;
};

type OrganizerUser = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
};

type Match = {
  id: string;
  organizer_id: string;
  community_id: string | null;
  title: string;
  location: string;
  scheduled_at: string;
  formation_type: string | null;
  booking_logic: string | null;
  position_enabled: boolean | null;
  max_players: number;
  price: number | null;
  status: MatchStatus | string;
  created_at?: string;
  google_maps_url?: string | null;
  image_urls?: string[] | null;
  communityName?: string | null;
  users?: {
    full_name: string | null;
    email?: string | null;
  } | null;
};

type EditFormData = {
  community_id: string;
  title: string;
  location: string;
  scheduled_at: string;
  formation_type: string;
  booking_logic: string;
  position_enabled: boolean;
  max_players: number;
  price: number;
  status: MatchStatus;
  google_maps_url: string;
};

const PUBLIC_MATCH_VALUE = "public";

export default function AdminMatchesPage() {
  const router = useRouter();
  const { user, loading, isAdmin, isMainAdmin } = useAuth();

  const canViewMatches = isAdmin || isMainAdmin;
  const canCreateMatches = false;
  const canEditMatches = isAdmin || isMainAdmin;
  const canDeleteMatches = isAdmin || isMainAdmin;
  const canTerminateMatches = isAdmin || isMainAdmin;

  const [pageLoading, setPageLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(
    null,
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [terminateTargetId, setTerminateTargetId] = useState<string | null>(
    null,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MatchStatus>("all");

  const [editFormData, setEditFormData] = useState<EditFormData>({
    community_id: PUBLIC_MATCH_VALUE,
    title: "",
    location: "",
    scheduled_at: "",
    formation_type: "",
    booking_logic: "",
    position_enabled: false,
    max_players: 10,
    price: 0,
    status: "open",
    google_maps_url: "",
  });

  const [editSelectedFiles, setEditSelectedFiles] = useState<File[]>([]);

  const communityMap = useMemo(() => {
    return new Map(
      communities.map((community) => [community.id, community.name]),
    );
  }, [communities]);

  const filteredMatches: Match[] = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return matches.filter((match: Match) => {
      const matchesSearch =
        !query ||
        match.title.toLowerCase().includes(query) ||
        match.location.toLowerCase().includes(query) ||
        (match.communityName ?? "").toLowerCase().includes(query) ||
        (match.users?.full_name ?? "").toLowerCase().includes(query) ||
        (match.users?.email ?? "").toLowerCase().includes(query) ||
        (match.formation_type ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : match.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [matches, searchTerm, statusFilter]);

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

      if (!canViewMatches) {
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
          bannedError.message,
          bannedError.details,
          bannedError.hint,
        );
        setErrorMessage("Failed to validate account status.");
        return;
      }

      if (bannedUser?.is_banned) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      const [matchRes, organizerRes, communityRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .order("scheduled_at", { ascending: false }),
        supabase.from("users").select("id, full_name, email"),
        supabase.from("communities").select("id, name"),
      ]);

      if (matchRes.error) {
        console.error(
          "Supabase error details:",
          matchRes.error.message,
          matchRes.error.details,
          matchRes.error.hint,
        );
        setErrorMessage("Failed to load matches.");
        return;
      }

      if (organizerRes.error) {
        console.error(
          "Supabase error details:",
          organizerRes.error.message,
          organizerRes.error.details,
          organizerRes.error.hint,
        );
        setErrorMessage("Failed to load organizers.");
        return;
      }

      if (communityRes.error) {
        console.error(
          "Supabase error details:",
          communityRes.error.message,
          communityRes.error.details,
          communityRes.error.hint,
        );
        setErrorMessage("Failed to load communities.");
        return;
      }

      const rawMatches = (matchRes.data as MatchRow[]) || [];
      const organizers = (organizerRes.data as OrganizerUser[]) || [];
      const loadedCommunities = (communityRes.data as CommunityRow[]) || [];

      setCommunities(loadedCommunities);

      const organizerMap = new Map(
        organizers.map((organizer) => [organizer.id, organizer]),
      );

      const normalizedMatches: Match[] = rawMatches.map((match: MatchRow) => {
        const organizer = organizerMap.get(match.organizer_id);

        return {
          id: match.id,
          organizer_id: match.organizer_id,
          community_id: match.community_id ?? null,
          title: match.title,
          location: match.location,
          scheduled_at: match.scheduled_at,
          formation_type: match.formation_type ?? null,
          booking_logic: match.booking_logic ?? null,
          position_enabled: match.position_enabled ?? false,
          max_players: match.max_players,
          price: match.price ?? null,
          status: match.status,
          created_at: match.created_at,
          google_maps_url: match.google_maps_url ?? null,
          image_urls: match.image_urls ?? [],
          communityName:
            match.community_id == null
              ? "Public Match"
              : (communityMap.get(match.community_id) ?? "Unknown Community"),
          users: organizer
            ? {
                full_name: organizer.full_name,
                email: organizer.email ?? null,
              }
            : null,
        };
      });

      setMatches(normalizedMatches);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while loading matches.");
    } finally {
      setPageLoading(false);
    }
  };

  const startEdit = (match: Match) => {
    setErrorMessage("");
    setSuccessMessage("");
    setEditingMatchId(match.id);
    setEditFormData({
      community_id: match.community_id ?? PUBLIC_MATCH_VALUE,
      title: match.title,
      location: match.location,
      scheduled_at: toDateTimeLocalValue(match.scheduled_at),
      formation_type: match.formation_type ?? "",
      booking_logic: match.booking_logic ?? "",
      position_enabled: match.position_enabled ?? false,
      max_players: match.max_players,
      price: match.price ?? 0,
      status:
        match.status === "open" ||
        match.status === "full" ||
        match.status === "cancelled"
          ? match.status
          : "open",
      google_maps_url: match.google_maps_url ?? "",
    });
    setEditSelectedFiles([]);
  };

  const cancelEdit = () => {
    setEditingMatchId(null);
    setEditFormData({
      community_id: PUBLIC_MATCH_VALUE,
      title: "",
      location: "",
      scheduled_at: "",
      formation_type: "",
      booking_logic: "",
      position_enabled: false,
      max_players: 10,
      price: 0,
      status: "open",
      google_maps_url: "",
    });
    setEditSelectedFiles([]);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setEditFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setEditFormData((prev) => ({
      ...prev,
      [name]:
        name === "max_players" || name === "price" ? Number(value) : value,
    }));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditSelectedFiles(Array.from(e.target.files ?? []));
  };

  const handleSaveEdit = async (matchId: string) => {
    try {
      setSavingEdit(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canEditMatches) {
        setErrorMessage("You do not have permission to edit matches.");
        return;
      }

      const trimmedTitle = editFormData.title.trim();
      const trimmedLocation = editFormData.location.trim();
      const trimmedFormationType = editFormData.formation_type.trim();
      const trimmedBookingLogic = editFormData.booking_logic.trim();
      const trimmedMapsUrl = editFormData.google_maps_url.trim();

      if (!trimmedTitle || !trimmedLocation || !editFormData.scheduled_at) {
        setErrorMessage("Please fill in all required fields.");
        return;
      }

      if (editFormData.max_players < 2) {
        setErrorMessage("Max players must be at least 2.");
        return;
      }

      const selectedCommunityId =
        editFormData.community_id === PUBLIC_MATCH_VALUE
          ? null
          : editFormData.community_id;

      const uploadedImageUrls = await uploadMatchImages(
        editSelectedFiles,
        user.id,
      );
      const existingImageUrls =
        matches.find((m: Match) => m.id === matchId)?.image_urls ?? [];
      const mergedImageUrls = [...existingImageUrls, ...uploadedImageUrls];

      const { data, error } = await supabase
        .from("matches")
        .update({
          community_id: selectedCommunityId,
          title: trimmedTitle,
          location: trimmedLocation,
          scheduled_at: editFormData.scheduled_at,
          formation_type: trimmedFormationType || null,
          booking_logic: trimmedBookingLogic || null,
          position_enabled: editFormData.position_enabled,
          max_players: editFormData.max_players,
          price: editFormData.price,
          status: editFormData.status,
          google_maps_url: trimmedMapsUrl || null,
          image_urls: mergedImageUrls,
        })
        .eq("id", matchId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error.message,
          error.details,
          error.hint,
        );
        setErrorMessage(error.message || "Failed to update match.");
        return;
      }

      const updatedMatch = data as MatchRow | null;

      if (updatedMatch) {
        const previous = matches.find((match: Match) => match.id === matchId);

        const normalizedMatch: Match = {
          id: updatedMatch.id,
          organizer_id: updatedMatch.organizer_id,
          community_id: updatedMatch.community_id ?? null,
          title: updatedMatch.title,
          location: updatedMatch.location,
          scheduled_at: updatedMatch.scheduled_at,
          formation_type: updatedMatch.formation_type ?? null,
          booking_logic: updatedMatch.booking_logic ?? null,
          position_enabled: updatedMatch.position_enabled ?? false,
          max_players: updatedMatch.max_players,
          price: updatedMatch.price ?? null,
          status: updatedMatch.status,
          created_at: updatedMatch.created_at,
          google_maps_url: updatedMatch.google_maps_url ?? null,
          image_urls: updatedMatch.image_urls ?? [],
          communityName:
            updatedMatch.community_id == null
              ? "Public Match"
              : (communityMap.get(updatedMatch.community_id) ??
                "Unknown Community"),
          users: previous?.users ?? null,
        };

        setMatches((prev) =>
          prev.map((match: Match) =>
            match.id === matchId ? normalizedMatch : match,
          ),
        );
      }

      setSuccessMessage("Match updated successfully.");
      cancelEdit();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while updating the match.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      setProcessingMatchId(matchId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canDeleteMatches) {
        setErrorMessage("You do not have permission to delete matches.");
        return;
      }

      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId);

      if (error) {
        console.error(
          "Supabase error details:",
          error.message,
          error.details,
          error.hint,
        );
        setErrorMessage(error.message || "Failed to delete match.");
        return;
      }

      setMatches((prev) => prev.filter((match: Match) => match.id !== matchId));

      if (editingMatchId === matchId) {
        cancelEdit();
      }

      setSuccessMessage("Match deleted successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while deleting the match.");
    } finally {
      setProcessingMatchId(null);
      setDeleteTargetId(null);
    }
  };

  const handleTerminateMatch = async (matchId: string) => {
    try {
      setProcessingMatchId(matchId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canTerminateMatches) {
        setErrorMessage("You do not have permission to terminate matches.");
        return;
      }

      const { data, error } = await supabase
        .from("matches")
        .update({ status: "cancelled" })
        .eq("id", matchId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error.message,
          error.details,
          error.hint,
        );
        setErrorMessage(error.message || "Failed to terminate match.");
        return;
      }

      const updatedMatch = data as MatchRow | null;

      if (updatedMatch) {
        const previous = matches.find((match: Match) => match.id === matchId);

        const normalizedMatch: Match = {
          id: updatedMatch.id,
          organizer_id: updatedMatch.organizer_id,
          community_id: updatedMatch.community_id ?? null,
          title: updatedMatch.title,
          location: updatedMatch.location,
          scheduled_at: updatedMatch.scheduled_at,
          formation_type: updatedMatch.formation_type ?? null,
          booking_logic: updatedMatch.booking_logic ?? null,
          position_enabled: updatedMatch.position_enabled ?? false,
          max_players: updatedMatch.max_players,
          price: updatedMatch.price ?? null,
          status: updatedMatch.status,
          created_at: updatedMatch.created_at,
          google_maps_url: updatedMatch.google_maps_url ?? null,
          image_urls: updatedMatch.image_urls ?? [],
          communityName:
            updatedMatch.community_id == null
              ? "Public Match"
              : (communityMap.get(updatedMatch.community_id) ??
                "Unknown Community"),
          users: previous?.users ?? null,
        };

        setMatches((prev) =>
          prev.map((match: Match) =>
            match.id === matchId ? normalizedMatch : match,
          ),
        );
      }

      setSuccessMessage("Match terminated successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while terminating the match.");
    } finally {
      setProcessingMatchId(null);
      setTerminateTargetId(null);
    }
  };

  const handleRemoveImage = async (matchId: string, imageUrl: string) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (!canEditMatches) {
        setErrorMessage("You do not have permission to remove match images.");
        return;
      }

      const match = matches.find((m: Match) => m.id === matchId);
      if (!match) return;

      const updatedUrls = (match.image_urls ?? []).filter(
        (url: string) => url !== imageUrl,
      );

      const { data, error } = await supabase
        .from("matches")
        .update({ image_urls: updatedUrls })
        .eq("id", matchId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error.message,
          error.details,
          error.hint,
        );
        setErrorMessage("Failed to remove image.");
        return;
      }

      const updatedMatch = data as MatchRow | null;

      if (updatedMatch) {
        setMatches((prev) =>
          prev.map((item: Match) =>
            item.id === matchId
              ? {
                  ...item,
                  image_urls: updatedMatch.image_urls ?? [],
                  google_maps_url: updatedMatch.google_maps_url ?? null,
                }
              : item,
          ),
        );
      }

      setSuccessMessage("Image removed successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while removing the image.");
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading matches...</p>
      </div>
    );
  }

  if (!user) return null;
  if (!canViewMatches) return null;

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Manage Matches</h1>
          <p className="mt-2 text-sm text-gray-600">
            Admin and Main Admin can observe, edit, delete, and terminate
            matches. Creating matches is disabled.
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

        <div className="space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">No matches found.</p>
            </div>
          ) : (
            filteredMatches.map((match: Match) => {
              const isEditing = editingMatchId === match.id;
              const coverImage = match.image_urls?.[0];

              return (
                <div
                  key={match.id}
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  {isEditing ? (
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-gray-900">
                          Edit Match
                        </h3>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          Editing
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Match Type
                          </label>
                          <select
                            name="community_id"
                            value={editFormData.community_id}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          >
                            <option value={PUBLIC_MATCH_VALUE}>
                              Public Match
                            </option>
                            {communities.map((community: CommunityRow) => (
                              <option key={community.id} value={community.id}>
                                {community.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Match Title
                          </label>
                          <input
                            name="title"
                            type="text"
                            value={editFormData.title}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Location
                          </label>
                          <input
                            name="location"
                            type="text"
                            value={editFormData.location}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Scheduled At
                          </label>
                          <input
                            name="scheduled_at"
                            type="datetime-local"
                            value={editFormData.scheduled_at}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Formation Type
                          </label>
                          <input
                            name="formation_type"
                            type="text"
                            value={editFormData.formation_type}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Booking Logic
                          </label>
                          <input
                            name="booking_logic"
                            type="text"
                            value={editFormData.booking_logic}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-8">
                          <input
                            id={`position_enabled_${match.id}`}
                            name="position_enabled"
                            type="checkbox"
                            checked={editFormData.position_enabled}
                            onChange={handleEditChange}
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={`position_enabled_${match.id}`}
                            className="text-sm font-medium text-gray-700"
                          >
                            Position Enabled
                          </label>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Max Players
                          </label>
                          <input
                            name="max_players"
                            type="number"
                            min={2}
                            value={editFormData.max_players}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Price
                          </label>
                          <input
                            name="price"
                            type="number"
                            min={0}
                            step="0.01"
                            value={editFormData.price}
                            onChange={handleEditChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Google Maps URL
                          </label>
                          <input
                            name="google_maps_url"
                            type="url"
                            value={editFormData.google_maps_url}
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
                            <option value="open">Open</option>
                            <option value="full">Full</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Add More Match Images
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleEditFileChange}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                          />
                          {editSelectedFiles.length > 0 && (
                            <p className="mt-2 text-xs text-gray-500">
                              {editSelectedFiles.length} new image(s) selected
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(match.id)}
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
                      {coverImage ? (
                        <div className="relative h-64 w-full">
                          <Image
                            src={coverImage}
                            alt={match.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 66vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-gray-100 text-sm text-gray-500">
                          No match image
                        </div>
                      )}

                      <div className="p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-2">
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                                {match.communityName || "Public Match"}
                              </span>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900">
                              {match.title}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                              Organizer:{" "}
                              {match.users?.full_name ||
                                match.users?.email ||
                                "Unknown"}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              match.status === "open"
                                ? "bg-green-100 text-green-700"
                                : match.status === "full"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {match.status}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
                          <p>
                            <span className="font-semibold text-gray-900">
                              Scheduled:
                            </span>{" "}
                            {new Date(match.scheduled_at).toLocaleString()}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Venue:
                            </span>{" "}
                            {match.location}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Formation:
                            </span>{" "}
                            {match.formation_type || "N/A"}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Booking Logic:
                            </span>{" "}
                            {match.booking_logic || "N/A"}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Max Players:
                            </span>{" "}
                            {match.max_players}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Price:
                            </span>{" "}
                            {match.price ?? 0}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Positions Enabled:
                            </span>{" "}
                            {match.position_enabled ? "Yes" : "No"}
                          </p>
                          {match.created_at && (
                            <p>
                              <span className="font-semibold text-gray-900">
                                Created:
                              </span>{" "}
                              {new Date(match.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        {match.google_maps_url && (
                          <div className="mt-4">
                            <a
                              href={match.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-gray-50"
                            >
                              Open in Google Maps
                            </a>
                          </div>
                        )}

                        {match.image_urls && match.image_urls.length > 0 && (
                          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                            {match.image_urls.map(
                              (url: string, index: number) => (
                                <div
                                  key={`${match.id}-${index}`}
                                  className="relative h-28 w-full overflow-hidden rounded-xl border"
                                >
                                  <Image
                                    src={url}
                                    alt={`Match image ${index + 1}`}
                                    fill
                                    sizes="(max-width: 768px) 50vw, 20vw"
                                    className="object-cover"
                                  />
                                  {canEditMatches && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleRemoveImage(match.id, url)
                                      }
                                      className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          {canEditMatches && (
                            <button
                              type="button"
                              onClick={() => startEdit(match)}
                              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}

                          {canDeleteMatches && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetId(match.id)}
                              disabled={processingMatchId === match.id}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingMatchId === match.id
                                ? "Working..."
                                : "Delete"}
                            </button>
                          )}

                          {canTerminateMatches &&
                            match.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() => setTerminateTargetId(match.id)}
                                disabled={processingMatchId === match.id}
                                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {processingMatchId === match.id
                                  ? "Working..."
                                  : "Terminate Match"}
                              </button>
                            )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Match"
        description="Are you sure you want to delete this match? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={processingMatchId === deleteTargetId}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            void handleDeleteMatch(deleteTargetId);
          }
        }}
      />

      <ConfirmModal
        open={!!terminateTargetId}
        title="Terminate Match"
        description="Are you sure you want to terminate this match? This will set its status to cancelled."
        confirmLabel="Terminate"
        confirmVariant="warning"
        loading={processingMatchId === terminateTargetId}
        onCancel={() => setTerminateTargetId(null)}
        onConfirm={() => {
          if (terminateTargetId) {
            void handleTerminateMatch(terminateTargetId);
          }
        }}
      />
    </>
  );
}

async function uploadMatchImages(
  files: File[],
  organizerId: string,
): Promise<string[]> {
  if (files.length === 0) return [];

  const uploadedUrls: string[] = [];

  for (const file of files) {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${organizerId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("match-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("match-images")
      .getPublicUrl(fileName);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}
