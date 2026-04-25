"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";

/**
 * ============================================================================
 * TYPE DEFINITIONS
 * Ensuring strict data typing and integrity between the Database and the UI.
 * ============================================================================
 */

type DbStatus = "upcoming" | "cancelled";
type FrontendStatus = "open" | "full" | "cancelled" | "completed";
type FrontendBookingLogic = "GeneralList" | "PositionBased";
type FrontendFormation = "5v5" | "6v6" | "7v7";
type PositionOption = "GK" | "DEF" | "MID" | "FWD";

type Match = {
  id: string;
  title: string;
  location: string;
  google_maps_url?: string | null; 
  scheduled_at: string;
  price: number | null;
  status: DbStatus;
  booking_logic: string;
  formation_type: string;
  max_players: number | null;
  image_urls?: string[] | null;
  pitch_images?: string[] | null; 
  facilities?: string[] | null; 
  displayDate?: string;    
  displayStatus?: FrontendStatus; 
  bookings_count?: number;
};

type EditFields = {
  title: string;
  location: string;
  google_maps_url: string; 
  scheduled_at: string;
  price: number;
  facilities: string[]; 
};

type FormState = {
  title: string;
  location: string;
  google_maps_url: string; 
  scheduled_at: string;
  formation_type: FrontendFormation;
  booking_logic: FrontendBookingLogic;
  max_players: number;
  price: number;
  facilities: string[]; 
};

/**
 * ============================================================================
 * CONSTANTS & CONFIGURATIONS
 * Fixed datasets and configuration maps for dynamic UI rendering.
 * ============================================================================
 */

const POSITION_OPTIONS: PositionOption[] = ["GK", "DEF", "MID", "FWD"];
const FACILITIES_LIST = ["Parking", "Showers", "Locker Room", "Bathroom", "Water"];

const FORMATION_TEMPLATES: Record<FrontendFormation, PositionOption[]> = {
  "5v5": ["GK", "DEF", "DEF", "FWD", "FWD", "GK", "DEF", "DEF", "FWD", "FWD"],
  "6v6": ["GK", "DEF", "DEF", "MID", "FWD", "FWD", "GK", "DEF", "DEF", "MID", "FWD", "FWD"],
  "7v7": ["GK", "DEF", "DEF", "MID", "MID", "FWD", "FWD", "GK", "DEF", "DEF", "MID", "MID", "FWD", "FWD"],
};

const BOOKING_LOGIC_MAP: Record<FrontendBookingLogic, string> = {
  GeneralList:   "general",
  PositionBased: "position_based",
};

const BOOKING_LOGIC_DISPLAY: Record<string, string> = {
  general:         "GeneralList",
  position_based:  "PositionBased",
};

const STATUS_STYLES: Record<FrontendStatus, string> = {
  open:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  full:      "bg-amber-50 text-amber-700 border border-amber-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  completed: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATUS_DOT: Record<FrontendStatus, string> = {
  open:      "bg-emerald-500",
  full:      "bg-amber-500",
  cancelled: "bg-red-500",
  completed: "bg-slate-400",
};

const INITIAL_FORM: FormState = {
  title: "", location: "", google_maps_url: "", scheduled_at: "",
  formation_type: "5v5", booking_logic: "GeneralList",
  max_players: 10, price: 0, facilities: [] 
};

/**
 * ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Dynamically computes the match status based on database state, time, and capacity.
 */
const deriveStatus = (match: Match, bookingsCount: number): FrontendStatus => {
  if (match.status === "cancelled") return "cancelled";
  
  // Calculate completion by assuming matches run for exactly 2 hours
  const matchEndTime = new Date(match.scheduled_at).getTime() + (2 * 60 * 60 * 1000);
  if (Date.now() > matchEndTime) return "completed";
  
  if (match.max_players && bookingsCount >= match.max_players) return "full";
  
  return "open";
};

/**
 * Formats the given date string into a structured visual output showing a 2-hour window.
 */
const formatMatchDateTime = (dateString: string): string => {
  const start = new Date(dateString);
  const end = new Date(start.getTime() + (2 * 60 * 60 * 1000)); // +2 Hours

  const dateStr = start.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const startStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  const endStr = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });

  return `${dateStr} | ${startStr} - ${endStr}`;
};

/**
 * ============================================================================
 * SHARED STYLES
 * Reusable Tailwind classes for standardized UI components.
 * ============================================================================
 */
const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder:text-slate-400";
const selectCls = "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all appearance-none cursor-pointer";
const labelCls = "text-xs font-semibold text-slate-700 uppercase tracking-wider";

/**
 * ============================================================================
 * MAIN COMPONENT
 * ============================================================================
 */
export default function OrganizerMatchesPage() {
  const { user, loading } = useAuth();
  
  // UI States
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [matches, setMatches]         = useState<Match[]>([]);
  const [errorMessage, setErrorMessage]     = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Editing States
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({ title: "", location: "", google_maps_url: "", scheduled_at: "", price: 0, facilities: [] });

  // Form States
  const [minDateTime, setMinDateTime]   = useState(""); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null); 
  const [selectedPitchFiles, setSelectedPitchFiles] = useState<File[]>([]); 
  const [formData, setFormData]         = useState<FormState>(INITIAL_FORM);
  const [dynamicPositions, setDynamicPositions] = useState<PositionOption[]>(FORMATION_TEMPLATES["5v5"]);

  // Calculate user timezone offset to establish valid date-time minimums on mount.
  useEffect(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    setMinDateTime(new Date(now.getTime() - offset).toISOString().slice(0, 16));
  }, []);

  /**
   * Fetches the organizer's active matches and maps their confirmed booking counts.
   */
  const loadPageData = useCallback(async (isSilentRefresh = false) => {
    if (!user) return;
    try {
      if (!isSilentRefresh) setPageLoading(true);

      // Fetch matches explicitly linked to the authenticated organizer
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("organizer_id", user.id) 
        .order("created_at", { ascending: false });
      
      if (matchesError) throw matchesError;

      const matchIds = (matchesData || []).map(m => m.id);
      let bookingsCountMap: Record<string, number> = {};

      // Efficiently batch fetch occupied positions to synchronize with mobile application logic
      if (matchIds.length > 0) {
        const { data: posData, error: posError } = await supabase
          .from("match_positions")
          .select("match_id")
          .in("match_id", matchIds)
          .eq("is_taken", true);

        if (!posError && posData) {
          posData.forEach(p => {
            bookingsCountMap[p.match_id] = (bookingsCountMap[p.match_id] || 0) + 1;
          });
        }
      }
      
      let formatted = ((matchesData as Match[]) ?? []).map(match => {
        const bCount = bookingsCountMap[match.id] || 0;
        return {
          ...match,
          bookings_count: bCount,
          displayDate: formatMatchDateTime(match.scheduled_at),
          displayStatus: deriveStatus(match, bCount),
        };
      });

      // Sort strategy: Push 'completed' matches to the bottom of the feed
      formatted.sort((a, b) => {
        if (a.displayStatus === "completed" && b.displayStatus !== "completed") return 1;
        if (a.displayStatus !== "completed" && b.displayStatus === "completed") return -1;
        return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
      });

      setMatches(formatted);
    } catch (err: any) {
      if (!isSilentRefresh) showError("Load Error: " + (err?.message || JSON.stringify(err)));
    } finally {
      if (!isSilentRefresh) setPageLoading(false);
    }
  }, [user]);

  // Trigger initial data load upon successful authentication.
  useEffect(() => {
    if (!loading) loadPageData(false);
  }, [loading, loadPageData]);

  // Maintain real-time accuracy via background polling every 60 seconds.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadPageData(true), 60000);
    return () => clearInterval(interval);
  }, [user, loadPageData]);

  // Toast notification helpers
  const showSuccess = (msg: string) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(""), 3000); };
  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(""), 4000); };

  // Manages generic form input changes and positional formation switching
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const finalValue = (name === "max_players" || name === "price") ? Number(value) : value;
      const updated = { ...prev, [name]: finalValue } as FormState;

      if (name === "formation_type" && prev.booking_logic === "PositionBased") {
        const template = FORMATION_TEMPLATES[value as FrontendFormation] ?? [];
        setDynamicPositions(template);
        updated.max_players = template.length;
      }
      
      if (name === "booking_logic" && value === "PositionBased") {
        updated.max_players = dynamicPositions.length;
      }
      return updated;
    });
  };

  // Toggles string additions/removals within the facilities arrays
  const toggleFacility = (facility: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility) ? prev.facilities.filter(f => f !== facility) : [...prev.facilities, facility]
    }));
  };

  const toggleEditFacility = (facility: string) => {
    setEditFields(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility) ? prev.facilities.filter(f => f !== facility) : [...prev.facilities, facility]
    }));
  };

  /**
   * Primary handler for match creation. Manages Supabase file uploads and database insertions.
   */
  const handleCreateMatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return showError("User not authenticated");
    
    // Core form validation checks prior to API requests
    if (!formData.title.trim()) return showError("Title cannot be empty.");
    if (formData.location.trim().length < 3) return showError("Venue name must be at least 3 characters.");
    if (formData.price < 0) return showError("Price cannot be negative.");
    if (new Date(formData.scheduled_at) < new Date()) return showError("Cannot schedule matches in the past.");
    if (formData.google_maps_url) {
      try { new URL(formData.google_maps_url); } 
      catch (_) { return showError("Please enter a valid URL for Google Maps."); }
    }

    setSubmitting(true);
    try {
      let imageUrl = "";
      let pitchImageUrls: string[] = []; 
      
      // Process cover image with graceful fallback on upload failure
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() ?? "jpg";
        const fileName = `cover_${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("match-images").upload(fileName, selectedFile);
        
        if (upErr) {
          showError("Cover image upload failed. Creating match without it.");
        } else {
          imageUrl = supabase.storage.from("match-images").getPublicUrl(fileName).data.publicUrl;
        }
      }

      // Process parallel uploads for the pitch gallery array
      if (selectedPitchFiles.length > 0) {
        const uploadPromises = selectedPitchFiles.map(async (file) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const fileName = `pitch_${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("match-images").upload(fileName, file);
          if (error) {
            showError(`Failed to upload gallery image: ${file.name}. Skipping it.`);
            return null;
          }
          return supabase.storage.from("match-images").getPublicUrl(fileName).data.publicUrl;
        });

        const results = await Promise.all(uploadPromises);
        pitchImageUrls = results.filter((url): url is string => url !== null);
      }

      // Finalize Match metadata insertion
      const { data: matchData, error: matchError } = await supabase.from("matches").insert([{
        organizer_id:     user.id,
        title:            formData.title,
        location:         formData.location,
        google_maps_url:  formData.google_maps_url || null, 
        scheduled_at:     formData.scheduled_at,
        formation_type:   formData.formation_type,
        booking_logic:    BOOKING_LOGIC_MAP[formData.booking_logic],
        position_enabled: formData.booking_logic === "PositionBased",
        max_players:      formData.max_players,
        price:            formData.price,
        status:           "upcoming" as DbStatus,
        image_urls:       imageUrl ? [imageUrl] : [],
        pitch_images:     pitchImageUrls,
        facilities:       formData.facilities 
      }]).select().single();

      if (matchError) throw matchError;

      // Automatically construct position sub-records if using a strategic formation
      if (formData.booking_logic === "PositionBased" && matchData) {
        const posRows = dynamicPositions.map((posName, index) => ({
            match_id: matchData.id, 
            position_name: posName, 
            team_side: index % 2 === 0 ? "top" : "bottom", 
            is_taken: false, 
            booked_by: null,
        }));
        const { error: posError } = await supabase.from("match_positions").insert(posRows);
        if (posError) throw posError;
      }

      showSuccess("Match published successfully!");
      
      // Apply optimistic update to local state to prevent unnecessary page reloads
      const newMatchFormatted: Match = {
        ...matchData,
        bookings_count: 0,
        displayDate: formatMatchDateTime(matchData.scheduled_at),
      };
      newMatchFormatted.displayStatus = deriveStatus(newMatchFormatted, 0);
      
      setMatches(prev => [newMatchFormatted, ...prev]);

      // Reset form variables
      setSelectedFile(null);
      setSelectedPitchFiles([]); 
      setFormData(INITIAL_FORM);
      setDynamicPositions(FORMATION_TEMPLATES["5v5"]);
      
    } catch (err: any) {
      showError("Process Failed: " + (err?.message || JSON.stringify(err)));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Sets the database status of a match to 'cancelled' upon user confirmation.
   */
  const handleCancelMatch = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this match?")) return;
    try {
      const { error } = await supabase.from("matches").update({ status: "cancelled" as DbStatus }).eq("id", id);
      if (error) throw error;
      
      showSuccess("Match cancelled successfully.");
      
      // Mutate local state optimistically
      setMatches(prev => prev.map(m => {
        if (m.id === id) {
          const updatedMatch = { ...m, status: "cancelled" as DbStatus };
          return { ...updatedMatch, displayStatus: deriveStatus(updatedMatch, m.bookings_count || 0) };
        }
        return m;
      }));

    } catch (err: any) {
      showError(err?.message || JSON.stringify(err));
    }
  };

  if (pageLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium tracking-wide">Loading Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" dir="ltr">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organizer Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and publish your matches</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Feed
          </div>
        </div>

        {/* ── TOAST MESSAGES ── */}
        {successMessage && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-sm px-4 py-3 rounded-xl shadow-sm">
            <span className="text-base">✓</span>
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 font-medium text-sm px-4 py-3 rounded-xl shadow-sm">
            <span className="text-base">⚠</span>
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── MATCH CREATION FORM ── */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-900">
              <h2 className="text-sm font-semibold text-white tracking-widest uppercase">New Match</h2>
              <p className="text-xs text-slate-400 mt-0.5">Fill in the details to publish</p>
            </div>

            <form onSubmit={handleCreateMatch} className="p-6 space-y-4">

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className={labelCls}>Match Title</label>
                <input name="title" required value={formData.title} onChange={handleChange} placeholder="e.g. Friday Night 5v5" className={inputCls} />
              </div>

              {/* Venue Input */}
              <div className="space-y-1.5">
                <label className={labelCls}>Venue Name</label>
                <input name="location" required value={formData.location} onChange={handleChange} placeholder="Venue name" className={inputCls} />
              </div>

              {/* Map Link Input */}
              <div className="space-y-1.5">
                <label className={labelCls}>Google Maps Link <span className="normal-case text-slate-400 font-normal">(optional)</span></label>
                <input name="google_maps_url" type="url" value={formData.google_maps_url} onChange={handleChange} placeholder="https://maps.google.com/..." className={inputCls} />
              </div>

              {/* Booking Mode Select */}
              <div className="space-y-1.5">
                <label className={labelCls}>Booking Mode</label>
                <div className="relative">
                  <select name="booking_logic" value={formData.booking_logic} onChange={handleChange} className={selectCls}>
                    <option value="GeneralList">General List</option>
                    <option value="PositionBased">Position Based</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</div>
                </div>
              </div>

              {/* Position Strategy Interface */}
              {formData.booking_logic === "PositionBased" && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Formation Setup</p>
                  </div>
                  <div className="relative">
                    <select name="formation_type" value={formData.formation_type} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-white text-slate-800 font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer">
                      <option value="5v5">5 vs 5 — 10 Slots</option>
                      <option value="6v6">6 vs 6 — 12 Slots</option>
                      <option value="7v7">7 vs 7 — 14 Slots</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {dynamicPositions.map((val, idx) => (
                      <select key={idx} value={val} onChange={e => {
                        const upd = [...dynamicPositions] as PositionOption[];
                        upd[idx] = e.target.value as PositionOption;
                        setDynamicPositions(upd);
                      }} className="px-2 py-1.5 text-xs border border-indigo-100 rounded-lg bg-white text-slate-700 font-bold outline-none focus:border-indigo-300 transition-all">
                        {POSITION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
              )}

              {/* Facility Checkboxes */}
              <div className="space-y-2">
                <label className={labelCls}>Facilities</label>
                <div className="flex flex-wrap gap-2">
                  {FACILITIES_LIST.map(fac => {
                    const isSelected = formData.facilities.includes(fac);
                    return (
                      <button type="button" key={fac} onClick={() => toggleFacility(fac)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                        }`}>
                        {isSelected ? "✓ " : ""}{fac}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cover Image Uploader */}
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Cover Image <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <label className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all group">
                  <span className="text-slate-400 group-hover:text-slate-600 text-base">🖼</span>
                  <span className="text-xs text-slate-500 group-hover:text-slate-700 font-medium truncate">
                    {selectedFile ? selectedFile.name : "Click to upload cover photo"}
                  </span>
                  <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>
              </div>

              {/* Pitch Gallery Uploader */}
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Pitch Gallery <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <label className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all group">
                  <span className="text-slate-400 group-hover:text-slate-600 text-base">📷</span>
                  <span className="text-xs text-slate-500 group-hover:text-slate-700 font-medium truncate">
                    {selectedPitchFiles.length > 0 ? `${selectedPitchFiles.length} photo(s) selected` : "Click to upload pitch photos"}
                  </span>
                  <input type="file" accept="image/*" multiple onChange={e => e.target.files && setSelectedPitchFiles(Array.from(e.target.files))} className="hidden" />
                </label>
              </div>

              {/* Scheduler Input */}
              <div className="space-y-1.5">
                <label className={labelCls}>Match Date & Time</label>
                <input name="scheduled_at" type="datetime-local" required min={minDateTime} value={formData.scheduled_at} onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all" />
              </div>

              {/* Financials & Capacities */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Price (JD)</label>
                  <input name="price" type="number" min="0" value={formData.price} onChange={handleChange} onKeyDown={e => e.preventDefault()}
                    className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Capacity</label>
                  <input name="max_players" type="number" min="1" value={formData.max_players} readOnly={formData.booking_logic === "PositionBased"} onChange={handleChange} onKeyDown={e => e.preventDefault()}
                    className={`${inputCls} ${formData.booking_logic === "PositionBased" ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`} />
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-700 active:bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : "Confirm & Publish"}
              </button>
            </form>
          </div>

          {/* ── MATCHES LIVE FEED ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                Matches Live Feed
              </h2>
              <span className="text-xs text-slate-400 font-medium">{matches.length} matches</span>
            </div>
            
            {matches.length === 0 && !pageLoading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                <div className="text-4xl mb-3">⚽</div>
                <p className="text-slate-500 font-medium text-sm">No matches yet</p>
                <p className="text-slate-400 text-xs mt-1">Create your first match using the form on the left.</p>
              </div>
            )}

            {matches.map(m => {
              // Evaluates and applies interaction lockouts if match state is final
              const isModifyDisabled = ["full", "completed", "cancelled"].includes(m.displayStatus || "");
              const statusKey = m.displayStatus ?? "open";

              return (
                <div key={m.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  
                  {/* Internal Card Wrapper */}
                  <div className="flex gap-5 p-5">
                    {/* Primary Match Asset */}
                    {m.image_urls?.[0] && (
                      <div className="w-28 h-20 relative rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                        <Image src={m.image_urls[0]} alt="match" fill className="object-cover" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        {/* Title and Metadata Layout */}
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate tracking-tight">{m.title}</h3>
                          
                          {/* Location with Google Maps Anchor */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-slate-600 font-medium">📍 {m.location}</span>
                            {m.google_maps_url && (
                              <a href={m.google_maps_url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-semibold hover:bg-indigo-100 transition-colors">
                                🗺️ Map
                              </a>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 font-medium mt-1">⏰ {m.displayDate}</p>
                          
                          {/* Categorization & Financial Constraints UI */}
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[statusKey]}`}>
                              {statusKey}
                            </span>
                            
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border border-slate-200">
                              {m.booking_logic}
                            </span>
                            
                            <span className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold">
                              {m.price} JD
                            </span>
                            
                            <span className="text-[10px] text-slate-500 font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                              {m.bookings_count} / {m.max_players} booked
                            </span>
                          </div>
                        </div>

                        {/* Interactive UI Buttons */}
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => { 
                              setEditingId(m.id); 
                              setEditFields({ 
                                title: m.title, 
                                location: m.location, 
                                google_maps_url: m.google_maps_url || "", 
                                scheduled_at: m.scheduled_at.slice(0, 16), 
                                price: m.price ?? 0,
                                facilities: m.facilities || [] 
                              }); 
                            }} 
                            disabled={isModifyDisabled}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-indigo-600 border border-indigo-200 disabled:opacity-30"
                          >
                            Modify
                          </button>
                          
                          {m.displayStatus !== "cancelled" && (
                            <button onClick={() => handleCancelMatch(m.id)}
                              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-red-500 border border-red-200">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* INLINE EDITING INTERFACE */}
                  {editingId === m.id && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-3">
                      <input value={editFields.title} onChange={e => setEditFields(prev => ({ ...prev, title: e.target.value }))} className={inputCls} />
                      <input value={editFields.location} onChange={e => setEditFields(prev => ({ ...prev, location: e.target.value }))} className={inputCls} />
                      <input type="url" value={editFields.google_maps_url} onChange={e => setEditFields(prev => ({ ...prev, google_maps_url: e.target.value }))} className={inputCls} />
                      <input type="datetime-local" value={editFields.scheduled_at} onChange={e => setEditFields(prev => ({ ...prev, scheduled_at: e.target.value }))} className={inputCls} />
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          try {
                            const { error } = await supabase.from("matches").update({ title: editFields.title, location: editFields.location, google_maps_url: editFields.google_maps_url || null, scheduled_at: editFields.scheduled_at, price: editFields.price, facilities: editFields.facilities }).eq("id", m.id);
                            if (error) throw error;
                            setEditingId(null);
                            loadPageData(true);
                          } catch (err: any) { showError(err?.message || JSON.stringify(err)); }
                        }} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-xs">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-white border px-5 py-2 rounded-lg text-xs">Discard</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}