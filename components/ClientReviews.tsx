"use client";

import { useState } from "react";
import ReviewForm from "@/components/ReviewForm";
import ReviewList from "@/components/ReviewList";

export default function ClientReviews({ facilityId }: { facilityId: string }) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <>
      <h2 className="font-semibold text-lg mb-2">Leave a Review</h2>
      <ReviewForm
        facilityId={facilityId}
        onReviewAdded={() => setRefreshSignal((s) => s + 1)}
      />

      <div className="mt-6">
        <h2 className="font-semibold text-lg mb-2">Reviews</h2>
        <ReviewList facilityId={facilityId} refreshSignal={refreshSignal} />
      </div>
    </>
  );
}
