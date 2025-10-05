"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a Supabase client for client-side use
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

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
      // ✅ Step 1: Check if the user is logged in via Shopify
      const res = await fetch("/api/shopify-session");
      const session = await res.json();

      if (!session.loggedIn) {
        setMessage("❌ You must be logged in to leave a review.");
        setLoading(false);
        return;
      }

      const customer = session.customer;

      // ✅ Step 2: Insert the review into Supabase
      const { error } = await supabase.from("reviews").insert({
        facility_id: facilityId,
        rating,
        comment,
        customer_email: customer.email,
        customer_name: `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
      });

      if (error) {
        console.error("Error adding review:", error.message);
        setMessage("⚠️ Error adding review. Please try again.");
      } else {
        setMessage("✅ Review submitted!");
        setComment("");
        setRating(5);

        // ✅ Refresh the review list
        if (onReviewAdded) onReviewAdded();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage("⚠️ Something went wrong.");
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
