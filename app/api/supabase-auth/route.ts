// app/api/supabase-auth/route.ts
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  // ✅ Get Next.js cookies (await required in Next.js 15)
  const cookieStore = await cookies();

  // ✅ Create a Supabase server client using secure cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error("Failed to set cookie:", error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {
            console.error("Failed to remove cookie:", error);
          }
        },
      },
    }
  );

  // ✅ Try to detect Shopify storefront session
  const shopifySession = cookieStore.get("customer_access_token")?.value;

  if (!shopifySession) {
    return NextResponse.json({
      authenticated: false,
      reason: "No Shopify session",
    });
  }

  // 🔒 Optional: Verify Shopify session via Storefront API (recommended for production)
  try {
    const verify = await fetch("https://picklerspop.com/api/2025-01/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN!,
      },
      body: JSON.stringify({
        query: `{
          customer(customerAccessToken: "${shopifySession}") {
            id
            email
          }
        }`,
      }),
    });

    const { data } = await verify.json();

    if (!data?.customer) {
      return NextResponse.json({
        authenticated: false,
        reason: "Invalid or expired Shopify session",
      });
    }

    // ✅ Optionally upsert this user into Supabase "users" table
    await supabase
      .from("users")
      .upsert({
        shopify_customer_id: data.customer.id,
        email: data.customer.email,
      });

    return NextResponse.json({
      authenticated: true,
      shopifyCustomer: data.customer,
    });
  } catch (error) {
    console.error("Error verifying Shopify session:", error);
    return NextResponse.json({
      authenticated: false,
      reason: "Error verifying Shopify session",
    });
  }
}
