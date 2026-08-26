"use client";

type MappedFacility = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
};

interface FacilityMapProps {
  facilities: MappedFacility[];
  highlightedFacilityId: string | null;
  onPinClick: (id: string) => void;
}

export default function FacilityMap({
  facilities,
  highlightedFacilityId,
  onPinClick,
}: FacilityMapProps) {
  const mappedFacilities = facilities.filter(
    (facility) =>
      Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)
  );
  if (mappedFacilities.length === 0) return null;

  const focusFacility =
    mappedFacilities.find((facility) => facility.id === highlightedFacilityId) ??
    mappedFacilities[0];
  const mapQuery = encodeURIComponent(
    mappedFacilities.map((facility) => facility.name).join(" OR ")
  );
  const centerLat = focusFacility.latitude;
  const centerLng = focusFacility.longitude;
  const src = `https://maps.google.com/maps?q=${mapQuery}&ll=${centerLat},${centerLng}&z=11&output=embed`;
  const deepLink = `https://www.google.com/maps/search/${mapQuery}/@${centerLat},${centerLng},11z`;

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 p-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Map</span>
          <span className="text-xs text-slate-400">Showing the current result page</span>
        </div>
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-400 underline hover:text-blue-300">Open in Maps</a>
      </div>
      <iframe
        key={`${mapQuery}-${highlightedFacilityId ?? "default"}`}
        title="Facility search map"
        src={src}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="min-h-72 flex-1"
      />
      <div className="flex flex-wrap gap-2 border-t border-slate-800 p-3">
        {mappedFacilities.map((facility) => (
          <button
            key={facility.id}
            type="button"
            onClick={() => onPinClick(facility.id)}
            className={`rounded-full px-2 py-1 text-xs ${
              facility.id === highlightedFacilityId
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {facility.name}
          </button>
        ))}
      </div>
    </div>
  );
}
