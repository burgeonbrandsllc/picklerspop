"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

type SearchMode = "text" | "radius";

const INITIAL_RADIUS_MILES = 10;
const METERS_PER_MILE = 1609.344;

function isFullZipCode(value: string) {
  return /^\d{5}$/.test(value);
}

export default function SearchableFacilityList() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");
  const [errorMessage, setErrorMessage] = useState("");
  const pageSize = 20;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const query = search.trim();
    if (!query) return;

    setLoading(true);
    setSearched(true);
    setPage(0);
    setErrorMessage("");
    setFacilities([]);

    if (isFullZipCode(query)) {
      setSearchMode("radius");

      try {
        const geocodeResponse = await fetch(
          `/api/geocode-zip?zip=${encodeURIComponent(query)}`
        );
        const geocode: {
          latitude?: number;
          longitude?: number;
          error?: string;
        } = await geocodeResponse.json();

        if (
          !geocodeResponse.ok ||
          typeof geocode.latitude !== "number" ||
          typeof geocode.longitude !== "number"
        ) {
          throw new Error(geocode.error || "Unable to locate that ZIP code.");
        }

        const { data, error } = await supabase.rpc(
          "facilities_within_radius",
          {
            ref_lat: geocode.latitude,
            ref_lng: geocode.longitude,
            radius_m: INITIAL_RADIUS_MILES * METERS_PER_MILE,
          }
        );

        if (error) {
          throw error;
        }

        setFacilities((data as Facility[]) || []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to search by ZIP code.";
        console.error("Error loading nearby facilities:", error);
        setErrorMessage(message);
        setFacilities([]);
      } finally {
        setLoading(false);
      }

      return;
    }

    setSearchMode("text");

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
      setErrorMessage("Unable to load facilities. Please try again.");
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
    setSearchMode("text");
    setErrorMessage("");
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
          ) : errorMessage ? (
            <p className="text-red-600">{errorMessage}</p>
          ) : facilities.length === 0 ? (
            <p className="text-gray-500">
              {searchMode === "radius"
                ? `No facilities found within ${INITIAL_RADIUS_MILES} miles.`
                : "No facilities found."}
            </p>
          ) : (
            <>
              {searchMode === "radius" && (
                <p className="mb-3 text-sm text-gray-600">
                  Showing {facilities.length} facilities within{" "}
                  {INITIAL_RADIUS_MILES} miles of ZIP {search.trim()}.
                </p>
              )}
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
              {searchMode === "text" && (
                <div className="mt-4">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    {loading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
