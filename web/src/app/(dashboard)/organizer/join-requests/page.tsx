"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ReasonModal from "@/components/ui/ReasonModal";

type JoinRequestStatus = "pending" | "approved" | "rejected";

type JoinRequestRow = {
  id: string;
  community_id: string;
  player_id: string;
  status: JoinRequestStatus | string;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  owner_id: string;
};

type PlayerRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

type JoinRequest = {
  id: string;
  community_id: string;
  player_id: string;
  status: JoinRequestStatus | string;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  communityName: string;
  playerName: string;
  playerEmail: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        approved
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
      pending
    </span>
  );
}

export default function OrganizerJoinRequestsPage() {
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
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");

  const [approveTarget, setApproveTarget] = useState<JoinRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);

  const canManageRequests = isAdmin || isMainAdmin || isOrganizer;
  const isApprovedOrganizerOnly = isOrganizer && !isAdmin && !isMainAdmin;

  useEffect(() => {
    if (!loading) {
      void loadPageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, roles, isOrganizer, isAdmin, isMainAdmin, verificationStatus]);

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        request.communityName.toLowerCase().includes(query) ||
        request.playerName.toLowerCase().includes(query) ||
        request.playerEmail.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      total: requests.length,
    };
  }, [requests]);

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

      if (!canManageRequests) {
        router.push("/");
        return;
      }

      if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
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

      const communitiesQuery =
        isAdmin || isMainAdmin
          ? supabase.from("communities").select("id, name, owner_id")
          : supabase
              .from("communities")
              .select("id, name, owner_id")
              .eq("owner_id", user.id);

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

      const communities = (communitiesData as CommunityRow[]) || [];
      const communityIds = communities.map((community) => community.id);

      if (communityIds.length === 0) {
        setRequests([]);
        return;
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from("community_join_requests")
        .select(
          "id, community_id, player_id, status, requested_at, reviewed_at, reviewed_by, rejection_reason"
        )
        .in("community_id", communityIds)
        .order("requested_at", { ascending: false });

      if (requestsError) {
        console.error(
          "Supabase error details:",
          requestsError?.message,
          requestsError?.details,
          requestsError?.hint
        );
        setErrorMessage("Failed to load join requests.");
        return;
      }

      const rawRequests = (requestsData as JoinRequestRow[]) || [];
      const playerIds = Array.from(
        new Set(rawRequests.map((request) => request.player_id))
      );

      let playerMap = new Map<string, PlayerRow>();

      if (playerIds.length > 0) {
        const { data: playersData, error: playersError } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", playerIds);

        if (playersError) {
          console.error(
            "Supabase error details:",
            playersError?.message,
            playersError?.details,
            playersError?.hint
          );
          setErrorMessage("Failed to load player details.");
          return;
        }

        playerMap = new Map(
          ((playersData as PlayerRow[]) || []).map((player) => [player.id, player])
        );
      }

      const communityMap = new Map(
        communities.map((community) => [community.id, community.name])
      );

      const normalizedRequests: JoinRequest[] = rawRequests.map((request) => {
        const player = playerMap.get(request.player_id);

        return {
          id: request.id,
          community_id: request.community_id,
          player_id: request.player_id,
          status: request.status,
          requested_at: request.requested_at,
          reviewed_at: request.reviewed_at ?? null,
          reviewed_by: request.reviewed_by ?? null,
          rejection_reason: request.rejection_reason ?? null,
          communityName: communityMap.get(request.community_id) ?? "Unknown Community",
          playerName: player?.full_name || "Unknown Player",
          playerEmail: player?.email || "No email",
        };
      });

      setRequests(normalizedRequests);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while loading join requests.");
    } finally {
      setPageLoading(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    try {
      setProcessingRequestId(request.id);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      const { error: memberError } = await supabase
        .from("community_members")
        .upsert(
          [
            {
              community_id: request.community_id,
              player_id: request.player_id,
              approved_by: user.id,
            },
          ],
          {
            onConflict: "community_id,player_id",
          }
        );

      if (memberError) {
        console.error(
          "Supabase error details:",
          memberError?.message,
          memberError?.details,
          memberError?.hint
        );
        setErrorMessage(memberError.message || "Failed to add community member.");
        return;
      }

      const { error: requestError } = await supabase
        .from("community_join_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: null,
        })
        .eq("id", request.id);

      if (requestError) {
        console.error(
          "Supabase error details:",
          requestError?.message,
          requestError?.details,
          requestError?.hint
        );
        setErrorMessage(requestError.message || "Failed to approve request.");
        return;
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "approved",
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id,
                rejection_reason: null,
              }
            : item
        )
      );

      setSuccessMessage("Join request approved successfully.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while approving the request.");
    } finally {
      setProcessingRequestId(null);
      setApproveTarget(null);
    }
  };

  const handleReject = async (request: JoinRequest, reason: string) => {
    try {
      setProcessingRequestId(request.id);
      setErrorMessage("");
      setSuccessMessage("");

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      const { error } = await supabase
        .from("community_join_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: reason,
        })
        .eq("id", request.id);

      if (error) {
        console.error(
          "Supabase error details:",
          error?.message,
          error?.details,
          error?.hint
        );
        setErrorMessage(error.message || "Failed to reject request.");
        return;
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "rejected",
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id,
                rejection_reason: reason,
              }
            : item
        )
      );

      setSuccessMessage("Join request rejected.");
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("Something went wrong while rejecting the request.");
    } finally {
      setProcessingRequestId(null);
      setRejectTarget(null);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading join requests...</p>
      </div>
    );
  }

  if (!user) return null;
  if (!canManageRequests) return null;

  if (isApprovedOrganizerOnly && verificationStatus !== "approved") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Community Join Requests
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            You need approved organizer access before managing join requests.
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
            Community Join Requests
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Approve or reject player requests to join your communities.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {stats.pending}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {stats.approved}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {stats.rejected}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {stats.total}
            </p>
          </div>
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
              <h2 className="text-lg font-semibold text-gray-900">
                All Requests
              </h2>
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
                  placeholder="Search player or community"
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
                    setStatusFilter(
                      e.target.value as "all" | "pending" | "approved" | "rejected"
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="pending">Pending</option>
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                No join requests match your filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border p-5 transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          {request.playerName}
                        </h3>
                        <StatusBadge status={request.status} />
                      </div>

                      <p className="text-sm text-gray-600">
                        Community: {request.communityName}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {request.playerEmail}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    <p>
                      Requested:{" "}
                      {new Date(request.requested_at).toLocaleString()}
                    </p>
                    {request.reviewed_at && (
                      <p>
                        Reviewed:{" "}
                        {new Date(request.reviewed_at).toLocaleString()}
                      </p>
                    )}
                    {request.status === "rejected" && request.rejection_reason && (
                      <p className="text-red-600">
                        Rejection reason: {request.rejection_reason}
                      </p>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setApproveTarget(request)}
                        disabled={processingRequestId === request.id}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? "Working..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRejectTarget(request)}
                        disabled={processingRequestId === request.id}
                        className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!approveTarget}
        title="Approve Join Request"
        description={`Approve ${approveTarget?.playerName || "this player"} to join ${approveTarget?.communityName || "this community"}?`}
        confirmLabel="Approve"
        confirmVariant="success"
        loading={processingRequestId === approveTarget?.id}
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) {
            void handleApprove(approveTarget);
          }
        }}
      />

      <ReasonModal
        open={!!rejectTarget}
        title="Reject Join Request"
        description={`Provide a reason for rejecting ${rejectTarget?.playerName || "this request"}.`}
        confirmLabel="Reject"
        loading={processingRequestId === rejectTarget?.id}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (rejectTarget) {
            void handleReject(rejectTarget, reason);
          }
        }}
      />
    </>
  );
}