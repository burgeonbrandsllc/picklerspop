// lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookies().set({ name, value, ...options });
          } catch {
            // cookies are readonly in Server Components (safe fallback)
          }
        },
        remove(name: string, options: any) {
          try {
            cookies().set({ name, value: "", ...options });
          } catch {
            // cookies are readonly in Server Components (safe fallback)
          }
        },
      },
    }
  );
}
