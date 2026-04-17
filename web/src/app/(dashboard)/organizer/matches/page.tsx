"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";

type MatchStatus = "open" | "full" | "cancelled";

type CommunityOption = {
  id: string;
  name: string;
  owner_id: string;
  status: "pending" | "active" | "rejected" | string;
};

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
const MATCH_IMAGES_BUCKET = "match-images";

export default function OrganizerMatchesPage() {
  const router = useRouter();
  const {
    user,
    roles,
    loading,
    isOrganizer,
    isAdmin,
    isMainAdmin,
    verificationStatus,
  } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    community_id: PUBLIC_MATCH_VALUE,
    title: "",
    location: "",
    scheduled_at: "",
    formation_type: "",
    booking_logic: "",
    position_enabled: false,
    max_players: 10,
    price: 0,
    status: "open" as MatchStatus,
    google_maps_url: "",
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

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

  const canManageMatches = isAdmin || isMainAdmin || isOrganizer;
  const isApprovedOrganizerOnly = isOrganizer && !isAdmin && !isMainAdmin;

  const activeCommunityMap = useMemo(() => {
    return new Map(communities.map((community) => [community.id, community.name]));
  }, [communities]);

  useEffect(() => {
    if (!loading) {
      void loadPageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, roles, isOrganizer, isAdmin, isMainAdmin, verificationStatus]);

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

      if (!canManageMatches) {
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

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        return;
      }

      const communitiesQuery =
        isAdmin || isMainAdmin
          ? supabase
              .from("communities")
              .select("id, name, owner_id, status")
              .eq("status", "active")
              .order("name", { ascending: true })
          : supabase
              .from("communities")
              .select("id, name, owner_id, status")
              .eq("owner_id", user.id)
              .eq("status", "active")
              .order("name", { ascending: true });

      const { data: communitiesData, error: communitiesError } =
        await communitiesQuery;

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

      const loadedCommunities = (communitiesData as CommunityOption[]) || [];
      setCommunities(loadedCommunities);

      const matchesQuery =
        isAdmin || isMainAdmin
          ? supabase
              .from("matches")
              .select("*")
              .order("scheduled_at", { ascending: false })
          : supabase
              .from("matches")
              .select("*")
              .eq("organizer_id", user.id)
              .order("scheduled_at", { ascending: false });

      const { data: matchesData, error: matchesError } = await matchesQuery;

      if (matchesError) {
        console.error(
          "Supabase error details:",
          matchesError?.message,
          matchesError?.details,
          matchesError?.hint
        );
        setErrorMessage("Failed to load your matches.");
        return;
      }

      const rawMatches = (matchesData as MatchRow[]) || [];

      const allCommunityIds = Array.from(
        new Set(
          rawMatches
            .map((match) => match.community_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      let allCommunityNames = new Map<string, string>();

      if (allCommunityIds.length > 0) {
        const { data: referencedCommunities, error: referencedCommunitiesError } =
          await supabase
            .from("communities")
            .select("id, name")
            .in("id", allCommunityIds);

        if (referencedCommunitiesError) {
          console.error(
            "Supabase error details:",
            referencedCommunitiesError?.message,
            referencedCommunitiesError?.details,
            referencedCommunitiesError?.hint
          );
        } else {
          allCommunityNames = new Map(
            ((referencedCommunities as Array<{ id: string; name: string }>) || []).map(
              (community) => [community.id, community.name]
            )
          );
        }
      }

      const normalizedMatches: Match[] = rawMatches.map((match) => ({
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
            : allCommunityNames.get(match.community_id) ??
              activeCommunityMap.get(match.community_id) ??
              "Unknown Community",
      }));

      setMatches(normalizedMatches);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while loading the page.");
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "max_players" || name === "price" ? Number(value) : value,
    }));
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(e.target.files ?? []));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditSelectedFiles(Array.from(e.target.files ?? []));
  };

  const resetForm = () => {
    setFormData({
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
    setSelectedFiles([]);
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

  const handleCreateMatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setUploadingImages(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canManageMatches) {
        setErrorMessage("You do not have access to create matches.");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        setErrorMessage("Only approved organizers can create matches.");
        return;
      }

      const trimmedTitle = formData.title.trim();
      const trimmedLocation = formData.location.trim();
      const trimmedFormationType = formData.formation_type.trim();
      const trimmedBookingLogic = formData.booking_logic.trim();
      const trimmedMapsUrl = formData.google_maps_url.trim();

      if (!trimmedTitle || !trimmedLocation || !formData.scheduled_at) {
        setErrorMessage("Please fill in all required fields.");
        return;
      }

      if (formData.max_players < 2) {
        setErrorMessage("Max players must be at least 2.");
        return;
      }

      const selectedCommunityId =
        formData.community_id === PUBLIC_MATCH_VALUE
          ? null
          : formData.community_id;

      const uploadedImageUrls = await uploadMatchImages(selectedFiles, user.id);

      const { data, error } = await supabase
        .from("matches")
        .insert([
          {
            organizer_id: user.id,
            community_id: selectedCommunityId,
            title: trimmedTitle,
            location: trimmedLocation,
            scheduled_at: formData.scheduled_at,
            formation_type: trimmedFormationType || null,
            booking_logic: trimmedBookingLogic || null,
            position_enabled: formData.position_enabled,
            max_players: formData.max_players,
            price: formData.price,
            status: formData.status,
            google_maps_url: trimmedMapsUrl || null,
            image_urls: uploadedImageUrls,
          },
        ])
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to create match.");
        return;
      }

      const createdMatch = data as MatchRow | null;

      if (createdMatch) {
        const normalizedMatch: Match = {
          id: createdMatch.id,
          organizer_id: createdMatch.organizer_id,
          community_id: createdMatch.community_id ?? null,
          title: createdMatch.title,
          location: createdMatch.location,
          scheduled_at: createdMatch.scheduled_at,
          formation_type: createdMatch.formation_type ?? null,
          booking_logic: createdMatch.booking_logic ?? null,
          position_enabled: createdMatch.position_enabled ?? false,
          max_players: createdMatch.max_players,
          price: createdMatch.price ?? null,
          status: createdMatch.status,
          created_at: createdMatch.created_at,
          google_maps_url: createdMatch.google_maps_url ?? null,
          image_urls: createdMatch.image_urls ?? [],
          communityName:
            createdMatch.community_id == null
              ? "Public Match"
              : activeCommunityMap.get(createdMatch.community_id) ??
                "Unknown Community",
        };

        setMatches((prev) => [normalizedMatch, ...prev]);
      }

      setSuccessMessage("Match created successfully.");
      resetForm();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while creating the match.");
    } finally {
      setSubmitting(false);
      setUploadingImages(false);
    }
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

      if (!canManageMatches) {
        setErrorMessage("You do not have access to edit matches.");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
        setErrorMessage("Only approved organizers can edit matches.");
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
        user.id
      );

      const existingImageUrls =
        matches.find((m) => m.id === matchId)?.image_urls ?? [];

      const mergedImageUrls = [...existingImageUrls, ...uploadedImageUrls];

      const updateBase = {
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
      };

      const updateQuery =
        isAdmin || isMainAdmin
          ? supabase.from("matches").update(updateBase).eq("id", matchId)
          : supabase
              .from("matches")
              .update(updateBase)
              .eq("id", matchId)
              .eq("organizer_id", user.id);

      const { data, error } = await updateQuery.select("*").maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to update match.");
        return;
      }

      const updatedMatch = data as MatchRow | null;

      if (updatedMatch) {
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
              : activeCommunityMap.get(updatedMatch.community_id) ??
                "Unknown Community",
        };

        setMatches((prev) =>
          prev.map((match) => (match.id === matchId ? normalizedMatch : match))
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
      setDeletingMatchId(matchId);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      if (!canManageMatches) {
        setErrorMessage("You do not have access to delete matches.");
        return;
      }

      const targetMatch = matches.find((match) => match.id === matchId);

      if (targetMatch?.image_urls?.length) {
        await deleteMatchImagesFromStorage(targetMatch.image_urls);
      }

      const deleteQuery =
        isAdmin || isMainAdmin
          ? supabase.from("matches").delete().eq("id", matchId)
          : supabase
              .from("matches")
              .delete()
              .eq("id", matchId)
              .eq("organizer_id", user.id);

      const { error } = await deleteQuery;

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to delete match.");
        return;
      }

      setMatches((prev) => prev.filter((match) => match.id !== matchId));

      if (editingMatchId === matchId) {
        cancelEdit();
      }

      setSuccessMessage("Match deleted successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while deleting the match.");
    } finally {
      setDeletingMatchId(null);
      setDeleteTargetId(null);
    }
  };

  const handleRemoveImage = async (matchId: string, imageUrl: string) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) return;

      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      const updatedUrls = (match.image_urls ?? []).filter((url) => url !== imageUrl);

      await deleteMatchImagesFromStorage([imageUrl]);

      const updateQuery =
        isAdmin || isMainAdmin
          ? supabase
              .from("matches")
              .update({ image_urls: updatedUrls })
              .eq("id", matchId)
          : supabase
              .from("matches")
              .update({ image_urls: updatedUrls })
              .eq("id", matchId)
              .eq("organizer_id", user.id);

      const { data, error } = await updateQuery.select("*").maybeSingle();

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage("Failed to remove image.");
        return;
      }

      const updatedMatch = data as MatchRow | null;

      if (updatedMatch) {
        setMatches((prev) =>
          prev.map((item) =>
            item.id === matchId
              ? {
                  ...item,
                  image_urls: updatedMatch.image_urls ?? [],
                  google_maps_url: updatedMatch.google_maps_url ?? null,
                }
              : item
          )
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
  if (!canManageMatches) return null;

  if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Matches</h1>
          <p className="mt-2 text-sm text-gray-600">
            You need approved organizer access before creating matches.
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
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin || isMainAdmin ? "Manage Matches" : "Organizer Matches"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Create matches, assign them to an approved community, or make them
            public.
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
                Create Match
              </h2>

              <form onSubmit={handleCreateMatch} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Match Type
                  </label>
                  <select
                    name="community_id"
                    value={formData.community_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  >
                    <option value={PUBLIC_MATCH_VALUE}>Public Match</option>
                    {communities.map((community) => (
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
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Example: Friday Night 5v5"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Venue Name
                  </label>
                  <input
                    name="location"
                    type="text"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Example: Urban FC Arena"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Scheduled At
                  </label>
                  <input
                    name="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Formation Type
                  </label>
                  <input
                    name="formation_type"
                    type="text"
                    value={formData.formation_type}
                    onChange={handleChange}
                    placeholder="Example: 5v5"
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
                    value={formData.booking_logic}
                    onChange={handleChange}
                    placeholder="Example: first come first served"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="position_enabled"
                    name="position_enabled"
                    type="checkbox"
                    checked={formData.position_enabled}
                    onChange={handleChange}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="position_enabled"
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
                    value={formData.max_players}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
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
                    value={formData.price}
                    onChange={handleChange}
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
                    value={formData.google_maps_url}
                    onChange={handleChange}
                    placeholder="Paste Google Maps link"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Match Images
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                  {selectedFiles.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      {selectedFiles.length} image(s) selected
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  >
                    <option value="open">Open</option>
                    <option value="full">Full</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting || uploadingImages}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingImages || submitting ? "Uploading..." : "Create Match"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-4">
              {matches.length === 0 ? (
                <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                  <p className="text-sm text-gray-500">
                    No matches yet. Create your first match.
                  </p>
                </div>
              ) : (
                matches.map((match) => {
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
                                {communities.map((community) => (
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
                                {match.image_urls.map((url, index) => (
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
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleRemoveImage(match.id, url)
                                      }
                                      className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-5 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => startEdit(match)}
                                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(match.id)}
                                disabled={deletingMatchId === match.id}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingMatchId === match.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
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
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Match"
        description="Are you sure you want to delete this match? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingMatchId === deleteTargetId}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            void handleDeleteMatch(deleteTargetId);
          }
        }}
      />
    </>
  );
}

async function uploadMatchImages(
  files: File[],
  organizerId: string
): Promise<string[]> {
  if (files.length === 0) return [];

  const uploadedUrls: string[] = [];

  for (const file of files) {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${organizerId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(MATCH_IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(MATCH_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

async function deleteMatchImagesFromStorage(imageUrls: string[]) {
  const paths = imageUrls
    .map(getStoragePathFromPublicUrl)
    .filter((path): path is string => Boolean(path));

  if (paths.length === 0) return;

  const { error } = await supabase.storage
    .from(MATCH_IMAGES_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Storage delete error:", error.message);
  }
}

function getStoragePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${MATCH_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return url.slice(index + marker.length);
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