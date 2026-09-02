import ClientReviews from "@/components/ClientReviews";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";

interface FacilityPageProps {
  params: Promise<{ id: string }>;
}

const PLAY_TYPE_LABELS: Record<string, string> = {
  open_play_no_divisions: "Open Play – No Divisions",
  open_play_by_division: "Open Play by Division",
  lessons: "Lessons",
  tournaments: "Tournaments",
  court_reservations: "Court Reservations",
};

const COURT_SURFACE_LABELS: Record<string, string> = {
  hard_court: "Hard Court",
  wood_floors: "Wood Floors",
  snap_tile: "Snap Tile",
  other: "Other",
};

const COURT_CLIMATE_LABELS: Record<string, string> = {
  indoors_ac: "Indoors with AC",
  indoors_no_ac: "Indoors – No AC",
  outdoors_covered: "Outdoors with Cover",
  outdoors_open: "Outdoors – No Cover",
};

function AttributeSection({ title, values, labels }: {
  title: string;
  values: string[] | string | null | undefined;
  labels: Record<string, string>;
}) {
  const items = Array.isArray(values) ? values : values ? [values] : [];
  return (
    <div className="mt-5">
      <h2 className="mb-2 text-base font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {items.length === 0 ? (
        <p className="text-base italic text-gray-400">Not specified</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((value) => (
            <span key={value} className="inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
              {labels[value] ?? value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-base">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

export default async function FacilityPage({ params }: FacilityPageProps) {
  const { id: facilityId } = await params;
  const supabase = await supabaseServer();
  const { data: facility, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", facilityId)
    .single();

  if (error) {
    console.error("Error fetching facility:", error.message);
    return <div className="p-6 text-red-600">Error loading facility: {error.message}</div>;
  }
  if (!facility) return <div className="p-6">Facility not found</div>;

  const legacyClimate = facility.indoor ? "Indoors" : facility.outdoor ? "Outdoors" : null;
  const address = [facility.address, facility.city, facility.state, facility.zip_code]
    .filter(Boolean)
    .join(", ");
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="mb-5 inline-block text-base font-medium text-blue-600 hover:underline">← Back to facility search</Link>
      <h1 className="text-3xl font-bold text-gray-500">{facility.name}</h1>
      <p className="mt-1 text-base text-gray-500">{address}</p>
      {address && (
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-base font-medium text-blue-600 hover:underline">Open directions</a>
      )}

      <div className="mt-5 space-y-1.5 rounded-lg border bg-gray-50 p-4">
        <InfoRow label="Courts" value={facility.court_count != null ? String(facility.court_count) : "Unknown"} />
        <InfoRow label="Lights" value={facility.lights === true ? "Yes" : facility.lights === false ? "No" : "Unknown"} />
        {!facility.court_climate && legacyClimate && <InfoRow label="Setting" value={legacyClimate} />}
      </div>

      <AttributeSection title="Play Type" values={facility.play_type} labels={PLAY_TYPE_LABELS} />
      <AttributeSection title="Court Surface" values={facility.court_surface} labels={COURT_SURFACE_LABELS} />
      <AttributeSection title="Court Climate" values={facility.court_climate} labels={COURT_CLIMATE_LABELS} />

      <section className="mt-8 border-t pt-6">
        <ClientReviews facilityId={facilityId} />
      </section>
    </main>
  );
}
