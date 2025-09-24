"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Facility = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_code?: string;
  court_count?: number;
  indoor?: boolean;
  outdoor?: boolean;
  lights?: boolean;
};

export default function SearchableFacilityList() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    setPage(0);

    const { data, error } = await supabase
      .from("facilities")
      .select("*")
      .or(
        [
          `name.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `state.ilike.%${search}%`,
          `zip_code.ilike.%${search}%`,
        ].join(",")
      )
      .order("name")
      .range(0, pageSize - 1);

    if (error) {
      console.error("Error loading facilities:", error.message);
      setFacilities([]);
    } else {
      setFacilities((data as Facility[]) || []);
    }

    setLoading(false);
  }

  async function loadMore() {
    const nextPage = page + 1;
    setLoading(true);

    const from = nextPage * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("facilities")
      .select("*")
      .or(
        [
          `name.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `state.ilike.%${search}%`,
          `zip_code.ilike.%${search}%`,
        ].join(",")
      )
      .order("name")
      .range(from, to);

    if (error) {
      console.error("Error loading more facilities:", error.message);
    } else {
      setFacilities((prev) => [...prev, ...((data as Facility[]) || [])]);
      setPage(nextPage);
    }

    setLoading(false);
  }

  function clearSearch() {
    setSearch("");
    setFacilities([]);
    setSearched(false);
    setPage(0);
  }

  return (
    <div>
      {/* Search bar with Search + Clear */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, city, state, or ZIP"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Search
        </button>
        {searched && (
          <button
            type="button"
            onClick={clearSearch}
            className="bg-gray-300 px-3 py-2 rounded"
          >
            Clear
          </button>
        )}
      </form>

      {/* Results */}
      {searched && (
        <>
          {loading && facilities.length === 0 ? (
            <p>Loading...</p>
          ) : facilities.length === 0 ? (
            <p className="text-gray-500">No facilities found.</p>
          ) : (
            <>
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
                      {f.city}, {f.state} {f.zip_code}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  {loading ? "Loading..." : "Load more"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
