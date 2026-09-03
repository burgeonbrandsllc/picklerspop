"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type MapLocation = {
  latitude: number;
  longitude: number;
};

interface FacilityMapProps {
  facilities: MappedFacility[];
  highlightedFacilityId: string | null;
  onPinClick: (id: string) => void;
  initialMode?: boolean;
  centerLocation?: MapLocation | null;
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

function createUserLocationIcon(leaflet: LeafletModule) {
  return leaflet.divIcon({
    className: "",
    html: '<div class="facility-map-user-pin" aria-label="Current user location" style="background:#D16002;height:37px;width:37px"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-3.31 0-6 2.02-6 4.5 0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5 0-2.48-2.69-4.5-6-4.5Z" /></svg></div>',
    iconSize: [37, 37],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

export default function FacilityMap({
  facilities,
  highlightedFacilityId,
  onPinClick,
  initialMode = false,
  centerLocation = null,
}: FacilityMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);

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
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setUserLocation(null);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 }
    );
  }, []);

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
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      mapRef.current.setView([39.8283, -98.5795], 4);
      setMapReady(true);
    }

    loadMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = [];
      userMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 150);

    if (mappedFacilities.length === 0) {
      const emptyStateCenter = centerLocation ?? (initialMode ? userLocation : null);
      if (emptyStateCenter) {
        map.setView([emptyStateCenter.latitude, emptyStateCenter.longitude], 12);
      }
      return;
    }

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

    requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 250);
  }, [centerLocation, highlightedFacilityId, initialMode, mapReady, mappedFacilities, onPinClick, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) return;

    userMarkerRef.current = leaflet.marker([userLocation.latitude, userLocation.longitude], {
      icon: createUserLocationIcon(leaflet),
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(map);
  }, [mapReady, userLocation]);

  function showUserLocation() {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    map.setView([userLocation.latitude, userLocation.longitude], map.getZoom(), {
      animate: true,
    });
  }

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
          <span className="text-base text-slate-400">{initialMode ? "Centered on your location" : "Showing all visible results"}</span>
        </div>
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-blue-400 underline hover:text-blue-300">Open in Maps</a>
      </div>

      <div className="relative min-h-72 flex-1">
        {mappedFacilities.length === 0 && !initialMode && !centerLocation ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950 p-6 text-center text-base text-slate-400">
            No mappable facilities found for this result set.
          </div>
        ) : null}
        <button
          type="button"
          onClick={showUserLocation}
          disabled={!userLocation}
          aria-label="Show your location"
          title={userLocation ? "Show your location" : "Current location unavailable"}
          className="absolute left-[10px] top-[86px] z-[1000] flex h-[34px] w-[34px] items-center justify-center rounded-sm border-2 border-black/20 bg-white text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
            <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8.94 3A9.004 9.004 0 0 0 13 3.06V1h-2v2.06A9.004 9.004 0 0 0 3.06 11H1v2h2.06A9.004 9.004 0 0 0 11 20.94V23h2v-2.06A9.004 9.004 0 0 0 20.94 13H23v-2h-2.06ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
          </svg>
        </button>
        <div ref={mapElementRef} className="h-full min-h-72 w-full" />
      </div>

      {mappedFacilities.length > 0 ? (
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
      ) : null}
    </div>
  );
}