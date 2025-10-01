// app/page.tsx
import SearchableFacilityList from "@/components/SearchableFacilityList";
import { supabaseServer } from "@/lib/supabaseServer";

export default function HomePage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Find Pickleball Facilities</h1>
      <SearchableFacilityList />
    </main>
  );
}
