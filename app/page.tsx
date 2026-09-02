// app/page.tsx
import SearchableFacilityList from "@/components/SearchableFacilityList";
import AuthDebugger from "@/components/AuthDebugger";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl p-4 text-slate-950 sm:p-6">
      <div className="mb-5">
        <p className="text-2xl font-extrabold uppercase tracking-wide text-blue-700">PicklersPop</p>
        <h1 className="mt-1 text-base font-semibold uppercase tracking-wide text-gray-500">Find Pickleball Facilities</h1>
        <p className="mt-2 text-base text-slate-400">Search nearby courts, explore the map, and read player reviews.</p>
      </div>
      <SearchableFacilityList />
      <AuthDebugger /> {/* ✅ shows if user is logged in */}
    </main>
  );
}
