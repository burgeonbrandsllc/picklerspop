// lib/supabaseServer.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies as nextCookies } from "next/headers";

export function supabaseServer() {
  const cookieStore = nextCookies(); // ✅ ensure it's a RequestCookies object

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // cookies are read-only in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // cookies are read-only in Server Components
          }
        },
      },
    }
  );
}
