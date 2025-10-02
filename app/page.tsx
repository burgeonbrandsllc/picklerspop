// app/page.tsx
import SearchableFacilityList from "@/components/SearchableFacilityList";
import AuthDebugger from "@/components/AuthDebugger";

export default function HomePage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Find Pickleball Facilities</h1>
      <SearchableFacilityList />
      <AuthDebugger /> {/* ✅ shows if user is logged in */}
    </main>
  );
}
