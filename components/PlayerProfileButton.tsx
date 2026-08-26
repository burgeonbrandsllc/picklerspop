"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSupabaseAuth } from "@/components/SupabaseProvider";

function getInitial(userMetadata: Record<string, unknown>, email?: string) {
  const firstName =
    typeof userMetadata.first_name === "string"
      ? userMetadata.first_name
      : typeof userMetadata.firstName === "string"
        ? userMetadata.firstName
        : "";
  const source = firstName.trim() || email?.trim() || "Player";
  return source.charAt(0).toUpperCase();
}

export default function PlayerProfileButton() {
  const { user } = useSupabaseAuth();
  const initial = useMemo(
    () => getInitial(user?.user_metadata ?? {}, user?.email),
    [user]
  );

  return (
    <Link
      href="/profile"
      aria-label="Open player profile"
      title="Player profile"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-700 bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
    >
      {initial}
    </Link>
  );
}
