import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ── Enums ────────────────────────────────────────────────────────────────────
export type UserRole = "main_admin" | "organizer" | "player";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type MatchStatus = "upcoming" | "ongoing" | "completed" | "cancelled";
export type BookingStatus = "confirmed" | "cancelled";
export type BookingLogic = "general" | "position";
export type DisputeStatus = "open" | "under_review" | "resolved";
export type RoleContext = "player" | "organizer";

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface User {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  average_rating: number | null;
  created_at: string;
  is_banned: boolean;  // ← add this
}

export interface Match {
  id: string;
  organizer_id: string;
  title: string;
  location: string;
  scheduled_at: string;
  formation_type: string;
  booking_logic: BookingLogic;
  position_enabled: boolean;
  max_players: number | null;
  price: number | null;
  status: MatchStatus;
  created_at: string;
}

export interface Booking {
  id: string;
  match_id: string;
  player_id: string;
  position_id: string | null;
  status: BookingStatus;
  created_at: string;
}

export interface MatchPosition {
  id: string;
  match_id: string;
  position_name: string;
  booked_by: string | null;
  is_taken: boolean;
  created_at: string;
}

export interface Rating {
  id: string;
  match_id: string;
  rater_id: string;
  rated_id: string;
  score: number;
  role_context: RoleContext;
  created_at: string;
}

export interface Dispute {
  id: string;
  reporter_id: string;
  reported_id: string;
  match_id: string | null;
  reason: string;
  status: DisputeStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}
// In src/lib/supabase.ts — add to User interface


export interface Verification {
  id: string;
  user_id: string;
  role: UserRole;
  status: VerificationStatus;
  document_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ── Auth functions ───────────────────────────────────────────────────────────
export async function signUp(
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) throw error;

  if (data.user) {
    await supabase.from("users").insert({
      id: data.user.id,
      email,
      full_name: fullName,
    });

    await supabase.from("user_roles").insert({
      user_id: data.user.id,
    });
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

export async function getCurrentUserRoles(): Promise<UserRole[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (data || []).map((r) => r.role as UserRole);
}

export async function hasRole(role: UserRole): Promise<boolean> {
  const roles = await getCurrentUserRoles();
  return roles.includes(role);
}
