"use client";
import { useEffect, useState } from "react";

export default function CustomerProfile() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shopify-sync")
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.reason || "API failed");
        setData(json.data);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <pre style={{ color: "red" }}>{error}</pre>;
  if (!data) return <p>Loading...</p>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}