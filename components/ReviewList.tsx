"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ReviewListProps {
  facilityId: string;
  refreshSignal: number; // bump this when new review submitted
}

export default function ReviewList({ facilityId, refreshSignal }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ Single definition of fetchReviews, wrapped in useCallback
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("facility_id", facilityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error.message);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  }, [facilityId]);

  // ✅ Trigger on mount and when refreshSignal changes
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, refreshSignal]);

  if (loading) return <p>Loading reviews...</p>;

  return (
    <section className="mt-6">
      <h2 className="font-semibold text-lg mb-2">Reviews</h2>
      {reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="border p-3 rounded">
              <div className="font-medium">⭐ {r.rating}</div>
              <p className="text-sm">{r.comment ?? "No comment"}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No reviews yet.</p>
      )}
    </section>
  );
}
