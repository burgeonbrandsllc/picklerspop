"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "@/components/SupabaseProvider";

type PlayerProfile = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  zip_code: string;
  rating: string;
  location: string;
  gender: string;
};

const emptyProfile: PlayerProfile = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  mobile_number: "",
  zip_code: "",
  rating: "",
  location: "",
  gender: "",
};

function metadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

const inputClass = "rounded-md border border-slate-300 bg-[#fbfbf7] px-3 py-2";

export default function PlayerProfileForm() {
  const { user, session } = useSupabaseAuth();
  const [profile, setProfile] = useState<PlayerProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fallbackProfile = useMemo<PlayerProfile>(() => {
    const metadata = user?.user_metadata ?? {};
    return {
      ...emptyProfile,
      email: user?.email ?? "",
      first_name: metadataValue(metadata, "first_name"),
      last_name: metadataValue(metadata, "last_name"),
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.access_token) {
        setProfile(fallbackProfile);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch("/api/player-profile", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.reason ?? "Unable to load player profile");
        }
        if (active) setProfile({ ...fallbackProfile, ...(body?.profile ?? {}) });
      } catch (loadError) {
        if (active) {
          setProfile(fallbackProfile);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load player profile"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [fallbackProfile, session?.access_token]);

  function updateField(field: keyof PlayerProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      setError("Sign in before editing your player profile.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/player-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profile),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.reason ?? "Unable to save player profile");
      }
      setProfile({ ...fallbackProfile, ...(body?.profile ?? {}) });
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save player profile"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 rounded-lg border border-slate-300 bg-[#f7f8f3] p-5 shadow-sm"
    >
      <fieldset disabled={loading || saving} className="grid gap-5">
        <section>
          <h2 className="text-xl font-semibold">Profile information</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-base font-medium">
              Username
              <input className={inputClass} value={profile.username} onChange={(event) => updateField("username", event.target.value)} autoComplete="username" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              Email
              <input className={inputClass} value={profile.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" type="email" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              First name
              <input className={inputClass} value={profile.first_name} onChange={(event) => updateField("first_name", event.target.value)} autoComplete="given-name" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              Last name
              <input className={inputClass} value={profile.last_name} onChange={(event) => updateField("last_name", event.target.value)} autoComplete="family-name" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              Mobile number
              <input className={inputClass} value={profile.mobile_number} onChange={(event) => updateField("mobile_number", event.target.value)} autoComplete="tel" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              ZIP code
              <input className={inputClass} value={profile.zip_code} onChange={(event) => updateField("zip_code", event.target.value)} autoComplete="postal-code" inputMode="numeric" />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Player attributes</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-base font-medium">
              Rating
              <input className={inputClass} value={profile.rating} onChange={(event) => updateField("rating", event.target.value)} inputMode="decimal" placeholder="3.5" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              Location
              <input className={inputClass} value={profile.location} onChange={(event) => updateField("location", event.target.value)} autoComplete="address-level2" />
            </label>
            <label className="grid gap-1 text-base font-medium">
              Gender
              <select className={inputClass} value={profile.gender} onChange={(event) => updateField("gender", event.target.value)}>
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="self_described">Self-described</option>
              </select>
            </label>
          </div>
        </section>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={loading || saving} className="rounded-md bg-emerald-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400">
          {saving ? "Saving..." : "Save profile"}
        </button>
        {loading && <p className="text-base text-slate-600">Loading profile...</p>}
        {message && <p className="text-base font-medium text-emerald-700">{message}</p>}
        {error && <p className="text-base font-medium text-red-700">{error}</p>}
      </div>
    </form>
  );
}
