"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

interface SupabaseContextValue {
  user: User | null;
  session: Session | null;
}

const SupabaseContext = createContext<SupabaseContextValue>({
  user: null,
  session: null,
});

type SupabaseAuthResponse = {
  authenticated?: boolean;
  session?: Pick<Session, "access_token" | "refresh_token">;
};

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        setSession(data.session);
        return;
      }

      try {
        const response = await fetch("/api/supabase-auth", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;

        const body = (await response.json().catch(() => null)) as
          | SupabaseAuthResponse
          | null;
        const accessToken = body?.session?.access_token;
        const refreshToken = body?.session?.refresh_token;
        if (!body?.authenticated || !accessToken || !refreshToken) return;

        const { data: sessionData, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled && !error) setSession(sessionData.session);
      } catch (error) {
        console.error("Unable to bootstrap Supabase session from Shopify:", error);
      }
    }

    loadSession();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider
      value={{ user: session?.user ?? null, session }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseContext);
}
