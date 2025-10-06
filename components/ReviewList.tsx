"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Review {
  id: string;
  facility_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
}

interface ReviewListProps {
  facilityId: string;
  refreshSignal?: number;
}

export default function ReviewList({ facilityId, refreshSignal }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReviews = useCallback(async () => {
    try {
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
    } catch (err) {
      console.error("Unexpected error fetching reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // Fetch reviews initially and whenever refreshSignal changes
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, refreshSignal]);

  return (
    <section className="mt-4">
      {loading ? (
        <p className="text-gray-500">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-gray-500">No reviews yet. Be the first to share your thoughts!</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">
                  {r.customer_name || "Anonymous"} — ⭐ {r.rating}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-700">
                {r.comment || "No comment provided."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
