import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a new Supabase client in the request context.
 * Compatible with Next.js 15+ where `cookies()` is async.
 */
export async function supabaseServer() {
  const cookieStore = await cookies(); // ✅ must await in your Next.js version

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
          } catch (error) {
            console.warn("⚠️ Unable to set cookie:", error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch (error) {
            console.warn("⚠️ Unable to remove cookie:", error);
          }
        },
      },
    }
  );
}
