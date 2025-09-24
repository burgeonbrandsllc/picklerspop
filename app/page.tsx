"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Load facilities on first render
  useEffect(() => {
    async function fetchFacilities() {
      setLoading(true);

      let query = supabase.from("facilities").select("*").order("name");

      if (search.trim() !== "") {
        // Match name OR city OR state (case-insensitive)
        query = query.or(
          `name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading facilities:", error.message);
        setFacilities([]);
      } else {
        setFacilities(data || []);
      }

      setLoading(false);
    }

    fetchFacilities();
  }, [search]); // re-run whenever search changes

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Find Pickleball Facilities</h1>

      {/* Search box */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, city, or state"
        className="w-full border rounded px-3 py-2 mb-4"
      />

      {loading ? (
        <p>Loading...</p>
      ) : facilities.length === 0 ? (
        <p className="text-gray-500">No facilities found.</p>
      ) : (
        <ul className="space-y-2">
          {facilities.map((f) => (
            <li key={f.id} className="border p-3 rounded">
              <a
                href={`/facilities/${f.id}`}
                className="font-semibold text-blue-600 underline"
              >
                {f.name}
              </a>
              <div className="text-sm text-gray-600">
                {f.city}, {f.state}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
