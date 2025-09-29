"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

interface ReviewListProps {
  facilityId: string;
  refreshSignal: number; // used to trigger re-fetch
}

export default function ReviewList({ facilityId, refreshSignal }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchReviews() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("facility_id", facilityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error.message);
      setReviews([]);
    } else {
      setReviews((data as Review[]) || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchReviews();
  }, [facilityId, refreshSignal]); // refetch whenever refreshSignal changes

  if (loading) return <p>Loading reviews...</p>;

  return reviews.length > 0 ? (
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
  );
}
