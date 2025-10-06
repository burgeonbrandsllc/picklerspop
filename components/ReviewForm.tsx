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
        rating,
        comment,
        user_id: supabaseSession.user?.id,
        customer_email: shopifyCustomer.email,
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
    <form onSubmit={handleSubmit} className="border p-4 rounded mt-6 space-y-3">
      <h3 className="font-semibold text-lg">Leave a Review</h3>

      <label className="block">
        <span className="text-sm font-medium">Rating</span>
        <select
          className="mt-1 border rounded p-2 w-full"
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
        <span className="text-sm font-medium">Comment</span>
        <textarea
          className="mt-1 border rounded p-2 w-full"
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

      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  );
}
