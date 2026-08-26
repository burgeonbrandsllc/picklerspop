// app/page.tsx
import SearchableFacilityList from "@/components/SearchableFacilityList";
import AuthDebugger from "@/components/AuthDebugger";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">PicklersPop</p>
        <h1 className="mt-1 text-3xl font-bold">Find Pickleball Facilities</h1>
        <p className="mt-1 text-sm text-gray-600">Search nearby courts, explore the map, and read player reviews.</p>
      </div>
      <SearchableFacilityList />
      <AuthDebugger /> {/* ✅ shows if user is logged in */}
    </main>
  );
}
