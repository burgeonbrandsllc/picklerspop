import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  // 1️⃣ Retrieve Shopify customer_access_token (set by your theme/app)
  const customerAccessToken = (await cookieStore).get("customer_access_token")?.value;

  if (!customerAccessToken) {
    return NextResponse.json({ loggedIn: false });
  }

  // 2️⃣ Create Supabase session using Shopify identity (pseudo-auth)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieStore }
  );

  // Optionally verify Shopify session via Storefront API before trusting
  return NextResponse.json({ loggedIn: true, shopifyToken: customerAccessToken });
}
