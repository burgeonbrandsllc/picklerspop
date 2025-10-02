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

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Load current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
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
