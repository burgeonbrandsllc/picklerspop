"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LatLngBoundsExpression, Map as LeafletMap, Marker } from "leaflet";

type LeafletModule = typeof import("leaflet");

type MappedFacility = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  resultNumber?: number;
};

interface FacilityMapProps {
  facilities: MappedFacility[];
  highlightedFacilityId: string | null;
  onPinClick: (id: string) => void;
}

function isFiniteCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function createNumberedIcon(leaflet: LeafletModule, number: number, active: boolean) {
  return leaflet.divIcon({
    className: "",
    html: `<div class="facility-map-pin${active ? " facility-map-pin-active" : ""}"><span>${number}</span></div>`,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

export default function FacilityMap({
  facilities,
  highlightedFacilityId,
  onPinClick,
}: FacilityMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const mappedFacilities = useMemo(
    () =>
      facilities.filter(
        (facility) =>
          isFiniteCoordinate(facility.latitude) &&
          isFiniteCoordinate(facility.longitude)
      ),
    [facilities]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      if (!mapElementRef.current || mapRef.current) return;

      const leaflet = await import("leaflet");
      if (cancelled || !mapElementRef.current || mapRef.current) return;

      leafletRef.current = leaflet;
      mapRef.current = leaflet.map(mapElementRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });

      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    loadMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (mappedFacilities.length === 0) return;

    const bounds: LatLngBoundsExpression = mappedFacilities.map((facility) => [
      facility.latitude as number,
      facility.longitude as number,
    ]);

    mappedFacilities.forEach((facility, index) => {
      const number = facility.resultNumber ?? index + 1;
      const active = facility.id === highlightedFacilityId;
      const marker = leaflet.marker([facility.latitude as number, facility.longitude as number], {
        icon: createNumberedIcon(leaflet, number, active),
        zIndexOffset: active ? 1000 : 0,
      })
        .addTo(map)
        .bindPopup(`<strong>${number}. ${facility.name}</strong><br />${facility.city}, ${facility.state}`);

      marker.on("click", () => onPinClick(facility.id));
      markersRef.current.push(marker);
    });

    if (mappedFacilities.length === 1) {
      map.setView([mappedFacilities[0].latitude as number, mappedFacilities[0].longitude as number], 12);
    } else {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    }
  }, [highlightedFacilityId, mappedFacilities, onPinClick]);

  const focusFacility =
    mappedFacilities.find((facility) => facility.id === highlightedFacilityId) ??
    mappedFacilities[0];
  const mapQuery = encodeURIComponent(
    mappedFacilities
      .map((facility) => `${facility.name} ${facility.city} ${facility.state}`)
      .join(" OR ")
  );
  const deepLink = focusFacility
    ? `https://www.google.com/maps/search/${mapQuery}/@${focusFacility.latitude},${focusFacility.longitude},11z`
    : "https://www.google.com/maps";

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 p-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Map</span>
          <span className="text-base text-slate-400">Showing all visible results</span>
        </div>
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-blue-400 underline hover:text-blue-300">Open in Maps</a>
      </div>

      <div className="relative min-h-72 flex-1">
        {mappedFacilities.length === 0 ? (
          <div className="flex h-full min-h-72 items-center justify-center bg-slate-950 p-6 text-center text-base text-slate-400">
            No mappable facilities found for this result set.
          </div>
        ) : null}
        <div ref={mapElementRef} className="h-full min-h-72 w-full" />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-800 p-3">
        {mappedFacilities.map((facility, index) => {
          const number = facility.resultNumber ?? index + 1;
          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => onPinClick(facility.id)}
              className={`rounded-full px-2.5 py-1.5 text-base ${
                facility.id === highlightedFacilityId
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {number}. {facility.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}