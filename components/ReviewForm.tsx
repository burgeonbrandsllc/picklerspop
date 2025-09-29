"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { supabase } from "@/lib/supabaseClient";

interface ReviewFormProps {
  facilityId: string;
  onReviewAdded: () => void; // callback to trigger refresh
}

export default function ReviewForm({ facilityId, onReviewAdded }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from("reviews").insert({
      facility_id: facilityId,
      rating,
      comment: comment.trim() === "" ? null : comment.trim(),
      user_id: null, // TODO: connect with Supabase Auth later
    });

    if (error) {
      console.error("Error adding review:", error?.message);
      setMessage("❌ Error adding review. Please try again.");
    } else {
      setMessage("✅ Review submitted!");
      setRating(5);
      setComment("");
      onReviewAdded(); // tell parent to refresh list
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Rating</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} ⭐
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>

      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  );
}
const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    setMessage("❌ You must be logged in to leave a review.");
    setLoading(false);
    return;
  }
  
  const { error } = await supabase.from("reviews").insert({
    facility_id: facilityId,
    rating,
    comment: comment.trim() === "" ? null : comment.trim(),
    user_id: user.id,
  });
  