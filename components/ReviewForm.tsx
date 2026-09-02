"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ReviewFormProps {
  facilityId: string;
  onReviewAdded?: () => void;
}

export default function ReviewForm({ facilityId, onReviewAdded }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Step 1️⃣: Verify Shopify customer session
      const shopifyRes = await fetch("/api/shopify-session", { cache: "no-store" });
      const shopifySession = await shopifyRes.json();

      if (!shopifySession?.authenticated) {
        setMessage("⚠️ Please sign in to your PicklersPop account to leave a review.");
        setLoading(false);
        return;
      }

      const shopifyCustomer = shopifySession.customer;
      if (!shopifyCustomer?.id || !shopifyCustomer?.email) {
        setMessage("⚠️ Invalid Shopify customer session data.");
        setLoading(false);
        return;
      }

      // Step 2️⃣: Sync Shopify session with Supabase
      const supabaseRes = await fetch("/api/supabase-auth", {
        method: "POST",
        cache: "no-store",
      });
      const supabaseSession = await supabaseRes.json();

      if (!supabaseSession?.authenticated) {
        setMessage("⚠️ Unable to verify Supabase session. Please refresh and try again.");
        setLoading(false);
        return;
      }

      if (!supabaseSession.playerId) {
        setMessage("⚠️ Unable to identify your player profile. Please refresh and try again.");
        setLoading(false);
        return;
      }

      // Step 3️⃣: Set Supabase auth session locally
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: supabaseSession.session?.access_token,
        refresh_token: supabaseSession.session?.refresh_token,
      });

      if (sessionError) {
        console.error("Error setting Supabase session:", sessionError.message);
        setMessage("⚠️ Unable to create a secure session.");
        setLoading(false);
        return;
      }

      // Step 4️⃣: Submit review
      const { error } = await supabase.from("reviews").insert({
        facility_id: facilityId,
        player_id: supabaseSession.playerId,
        rating,
        comment,
      });

      if (error) {
        console.error("Error adding review:", error.message);
        setMessage("⚠️ Error adding review. Please try again.");
      } else {
        setMessage("✅ Review submitted!");
        setComment("");
        setRating(5);

        if (onReviewAdded) onReviewAdded();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage("⚠️ Something went wrong while submitting your review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded border border-slate-300 bg-[#f7f8f3] p-4 text-slate-900">
      <h3 className="text-xl font-semibold text-slate-950">Leave a Review</h3>

      <label className="block">
        <span className="text-base font-medium text-slate-900">Rating</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 bg-[#fbfbf7] p-2 text-slate-950 placeholder:text-slate-500"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          disabled={loading}
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} ⭐
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-base font-medium text-slate-900">Comment</span>
        <textarea
          className="mt-1 w-full rounded border border-slate-300 bg-[#fbfbf7] p-2 text-slate-950 placeholder:text-slate-500"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={loading}
          placeholder="Share your experience..."
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>

      {message && <p className="mt-2 text-base text-slate-900">{message}</p>}
    </form>
  );
}
