// lib/supabaseServer.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const store = await cookies(); // ✅ await since it's a Promise
          return store.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            const store = await cookies();
            store.set({ name, value, ...options });
          } catch {
            // cookies are read-only in Server Components
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            const store = await cookies();
            store.set({ name, value: "", ...options });
          } catch {
            // cookies are read-only in Server Components
          }
        },
      },
    }
  );
}
