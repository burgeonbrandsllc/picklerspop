// app/page.tsx
import { supabase } from "@/lib/supabase";

export default async function HomePage() {
  const { data: facilities, error } = await supabase
    .from("facilities")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    return <div className="text-red-600">Error loading facilities</div>;
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Pickleball Facilities</h1>
      <ul className="space-y-2">
        {facilities?.map((f) => (
          <li key={f.id} className="border p-3 rounded">
            <a href={`/facilities/${f.id}`} className="font-semibold text-blue-600 underline">
              {f.name}
            </a>
            <div className="text-sm text-gray-600">
              {f.city}, {f.state}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
