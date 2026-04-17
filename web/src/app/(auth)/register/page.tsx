"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!file) {
      setError("Please upload your CV to continue.");
      return;
    }

    setLoading(true);

    try {
      // ── Step 1: Sign up ───────────────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Registration failed. Please try again.");

      const userId = authData.user.id;

      // ── Steps 2 & 3: Profile + role inserts in parallel ───────
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("users").upsert(
          { id: userId, email, full_name: fullName },
          { onConflict: "id" }
        ),
        supabase.from("user_roles").insert({ user_id: userId, role: "organizer" }),
      ]);

      if (profileResult.error)
        throw new Error(`Failed to create profile: ${profileResult.error.message}`);
      if (roleResult.error)
        throw new Error(`Failed to assign role: ${roleResult.error.message}`);

      // ── Step 4: Upload CV ─────────────────────────────────────
      let documentUrl: string | null = null;
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const { data: uploadData } = await supabase.storage
        .from("verification-docs")
        .upload(fileName, file);
      documentUrl = uploadData?.path ?? null;

      // ── Step 5: Create verification record ───────────────────
      await supabase.from("verifications").insert({
        user_id: userId,
        role: "organizer",
        document_url: documentUrl,
        status: "pending",
      });

      // ── Step 6: Sign out + show success ──────────────────────
      await supabase.auth.signOut();
      setSuccessMessage(
        "📬 Application submitted! Your organizer application is under review. You will receive an email once approved (1–2 business days)."
      );
      setEmail("");
      setPassword("");
      setFullName("");
      setFile(null);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1 text-center">
          Apply as Organizer
        </h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          Submit your application to manage matches on GSC Platform
        </p>

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 leading-relaxed">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            className="w-full p-3 border border-gray-200 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            className="w-full p-3 border border-gray-200 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            value={password}
            className="w-full p-3 border border-gray-200 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-xs text-gray-500 mb-2 font-medium">
              Upload CV (PDF only) <span className="text-red-500">*</span>
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Submitting Application..." : "Submit Application"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-green-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}