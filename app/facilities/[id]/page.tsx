import { supabase } from "@/lib/supabase";

export default async function FacilityPage({ params }: { params: { id: string } }) {
  // Fetch the facility by id
  const { data: facility, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) {
    console.error("Error fetching facility:", error.message);
    return <div className="text-red-600">Error loading facility: {error.message}</div>;
  }

  if (!facility) {
    return <div>Facility not found</div>;
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">{facility.name}</h1>
      <p className="mt-2 text-gray-600">
        {facility.address}, {facility.city}, {facility.state}
      </p>
      <ul className="mt-4 list-disc list-inside text-sm text-gray-700">
        <li>Court count: {facility.court_count ?? "Unknown"}</li>
        <li>{facility.indoor ? "Indoor" : facility.outdoor ? "Outdoor" : "Indoor/Outdoor unknown"}</li>
        <li>{facility.lights ? "Lights available" : "No lights"}</li>
      </ul>
    </main>
  );
}
