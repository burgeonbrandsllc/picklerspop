"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import FacilityMap from "@/components/FacilityMap";
import { supabase } from "@/lib/supabaseClient";

type Facility = {
  id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zip_code?: string;
  court_count?: number;
  indoor?: boolean;
  outdoor?: boolean;
  lights?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

type ResultMode = "text" | "radius" | "no-location";

const RADIUS_STEPS = [10, 25, 50, 100];
const METERS_PER_MILE = 1609.344;
const MIN_DESIRED_RESULTS = 50;
const PAGE_SIZE = 10;

function isFullZipCode(value: string) {
  return /^\d{5}$/.test(value);
}

function isStateCode(value: string) {
  return /^[a-zA-Z]{2}$/.test(value);
}

function safeFilterValue(value: string) {
  return value.replace(/[,()'\"]/g, " ").trim();
}

function buildTextFilter(value: string) {
  const query = safeFilterValue(value);
  if (isStateCode(query)) return `state.ilike.${query}`;
  return [
    `name.ilike.%${query}%`,
    `city.ilike.%${query}%`,
    `state.ilike.%${query}%`,
    `zip_code.ilike.%${query}%`,
  ].join(",");
}

async function lookupZip(zip: string) {
  const response = await fetch(`/api/geocode-zip?zip=${encodeURIComponent(zip)}`);
  const body: { latitude?: number; longitude?: number; error?: string } =
    await response.json();
  if (
    !response.ok ||
    typeof body.latitude !== "number" ||
    typeof body.longitude !== "number"
  ) {
    throw new Error(body.error || "Unable to locate that ZIP code.");
  }
  return { latitude: body.latitude, longitude: body.longitude };
}

async function fetchWithinRadius(
  latitude: number,
  longitude: number,
  radiusMiles: number
) {
  const { data, error } = await supabase.rpc("facilities_within_radius", {
    ref_lat: latitude,
    ref_lng: longitude,
    radius_m: radiusMiles * METERS_PER_MILE,
  });
  if (error) throw error;
  return (data as Facility[]) || [];
}

export default function SearchableFacilityList() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMode, setResultMode] = useState<ResultMode>("text");
  const [radiusMiles, setRadiusMiles] = useState(RADIUS_STEPS[0]);
  const [searchCoords, setSearchCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [highlightedFacilityId, setHighlightedFacilityId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentRadiusIndex = RADIUS_STEPS.indexOf(radiusMiles);
  const nextRadius = RADIUS_STEPS[currentRadiusIndex + 1] ?? null;
  const pageFacilities =
    resultMode === "radius"
      ? facilities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      : facilities;

  async function fetchTextPage(search: string, pageIndex: number) {
    setLoading(true);
    setErrorMessage("");
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("facilities")
      .select("*", { count: "exact" })
      .or(buildTextFilter(search))
      .order("name")
      .range(from, to);

    if (error) {
      console.error("Error loading facilities:", error.message);
      setErrorMessage("Unable to load facilities. Please try again.");
      setFacilities([]);
      setTotalCount(0);
    } else {
      setFacilities((data as Facility[]) || []);
      setTotalCount(count ?? 0);
      setResultMode("text");
    }
    setLoading(false);
  }

  async function startRadiusSearch(zip: string) {
    setLoading(true);
    setErrorMessage("");
    setResultMode("radius");
    setRadiusMiles(RADIUS_STEPS[0]);

    try {
      const coords = await lookupZip(zip);
      const results = await fetchWithinRadius(
        coords.latitude,
        coords.longitude,
        RADIUS_STEPS[0]
      );
      setSearchCoords(coords);
      setFacilities(results);
      setTotalCount(results.length);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to search by ZIP code.";
      console.error("Error loading nearby facilities:", error);
      setResultMode("no-location");
      setErrorMessage(message);
      setSearchCoords(null);
      setFacilities([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;

    setSearched(true);
    setSubmittedQuery(search);
    setPage(0);
    setFacilities([]);
    setTotalCount(0);
    setHighlightedFacilityId(null);

    if (isFullZipCode(search)) {
      await startRadiusSearch(search);
    } else {
      setSearchCoords(null);
      await fetchTextPage(search, 0);
    }
  }

  async function expandRadius() {
    if (!searchCoords || !nextRadius) return;
    setExpanding(true);
    setErrorMessage("");
    try {
      const results = await fetchWithinRadius(
        searchCoords.latitude,
        searchCoords.longitude,
        nextRadius
      );
      setRadiusMiles(nextRadius);
      setFacilities(results);
      setTotalCount(results.length);
      setPage(0);
      setHighlightedFacilityId(null);
    } catch (error) {
      console.error("Error expanding facility radius:", error);
      setErrorMessage("Unable to expand the search radius. Please try again.");
    } finally {
      setExpanding(false);
    }
  }

  async function goToPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalPages || nextPage === page) return;
    setPage(nextPage);
    setHighlightedFacilityId(null);
    if (resultMode === "text") {
      await fetchTextPage(submittedQuery, nextPage);
    }
    document.getElementById("facility-results")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
    setFacilities([]);
    setTotalCount(0);
    setPage(0);
    setSearched(false);
    setErrorMessage("");
    setResultMode("text");
    setSearchCoords(null);
    setRadiusMiles(RADIUS_STEPS[0]);
    setHighlightedFacilityId(null);
    inputRef.current?.focus();
  }

  const startResult = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const endResult = Math.min((page + 1) * PAGE_SIZE, totalCount);
  const mapFacilities = pageFacilities.map((facility, index) => ({
    ...facility,
    resultNumber: page * PAGE_SIZE + index + 1,
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#f7f8f3] shadow-sm">
      <div className="border-b border-slate-300 bg-[#eef3ef] p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, city, state, or ZIP"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-[#fbfbf7] px-3 py-2 text-slate-950"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={loading || !query.trim()} className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Searching..." : "Search"}
          </button>
          {searched && (
            <button type="button" onClick={clearSearch} className="rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-300">Clear</button>
          )}
        </form>
        <p className="mt-2 text-base text-slate-500">
          Enter a full five-digit ZIP for nearby facilities, or search by facility name, city, or state.
        </p>
      </div>

      {!searched ? (
        <div className="p-8 text-center text-slate-500">Search to find pickleball facilities.</div>
      ) : loading && facilities.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Loading facilities...</div>
      ) : errorMessage && facilities.length === 0 ? (
        <div className="p-8 text-center text-red-600">{errorMessage}</div>
      ) : facilities.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          {resultMode === "radius"
            ? `No facilities found within ${radiusMiles} miles of ${submittedQuery}.`
            : `No facilities found for “${submittedQuery}”.`}
        </div>
      ) : (
        <div className="grid min-h-[36rem] lg:grid-cols-2">
          <div className="h-72 border-b border-slate-300 bg-slate-950 lg:h-auto lg:border-b-0 lg:border-r">
            <FacilityMap
              facilities={mapFacilities}
              highlightedFacilityId={highlightedFacilityId}
              onPinClick={(id) => {
                setHighlightedFacilityId(id);
                document.getElementById(`facility-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
            />
          </div>

          <div id="facility-results" className="max-h-[46rem] overflow-y-auto p-4">
            <div className="mb-3 text-base text-slate-600">
              {resultMode === "radius" ? (
                <span>Showing {totalCount} facilities within <strong>{radiusMiles} miles</strong> of ZIP {submittedQuery}.</span>
              ) : (
                <span>Showing {startResult}–{endResult} of <strong>{totalCount}</strong> matches.</span>
              )}
            </div>

            {errorMessage && <p className="mb-3 rounded-md bg-red-50 p-2 text-base text-red-700">{errorMessage}</p>}

            <ol className="space-y-2">
              {pageFacilities.map((facility, index) => {
                const resultNumber = page * PAGE_SIZE + index + 1;
                const highlighted = facility.id === highlightedFacilityId;
                return (
                  <li
                    key={facility.id}
                    id={`facility-${facility.id}`}
                    onClick={() => setHighlightedFacilityId(facility.id)}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${highlighted ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:bg-[#eef3ef]"}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white">{resultNumber}</span>
                    <div className="min-w-0">
                      <Link href={`/facilities/${facility.id}`} className="font-semibold text-blue-700 underline hover:text-blue-900" onClick={(event) => event.stopPropagation()}>{facility.name}</Link>
                      <div className="text-base text-slate-600">{facility.city}, {facility.state} {facility.zip_code}</div>
                      {facility.court_count != null && <div className="mt-1 text-base text-slate-500">{facility.court_count} court{facility.court_count === 1 ? "" : "s"}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>

            {resultMode === "radius" && totalCount < MIN_DESIRED_RESULTS && nextRadius && (
              <button type="button" onClick={expandRadius} disabled={expanding} className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {expanding ? "Searching..." : `Expand search to ${nextRadius} miles`}
              </button>
            )}

            {totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-between gap-3 border-t pt-4" aria-label="Facility result pages">
                <button type="button" onClick={() => goToPage(page - 1)} disabled={page === 0 || loading} className="rounded-md border border-slate-300 px-3 py-1.5 text-base disabled:opacity-40">Previous</button>
                <span className="text-base text-slate-600">Page {page + 1} of {totalPages}</span>
                <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1 || loading} className="rounded-md border border-slate-300 px-3 py-1.5 text-base disabled:opacity-40">Next</button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
