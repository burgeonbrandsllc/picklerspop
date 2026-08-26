import PlayerProfileForm from "@/components/PlayerProfileForm";

export const metadata = {
  title: "Player Profile | PicklersPop",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Player Profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Your pickleball details</h1>
        </div>
        <PlayerProfileForm />
      </div>
    </main>
  );
}
