// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "No token found in cookies" },
        { status: 401 }
      );
    }

    // 🔒 Normalize token to ensure prefix
    const accessToken = token.startsWith("shcat_")
      ? token
      : `shcat_${token}`;

    console.log("🧩 Token starts with:", accessToken.slice(0, 12));
    console.log("📏 Token length:", accessToken.length);

    // Discover the proper customer GraphQL endpoint
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const discovery = await fetch(
      `https://${shopDomain}/.well-known/customer-account-api`
    );
    const config = await discovery.json();
    const graphqlEndpoint =
      config.graphql_api || `https://${shopDomain}/customer/api/graphql`;

    // 🔍 Test query
    const query = `
      query {
        customer {
          id
          emailAddress { emailAddress }
          firstName
          lastName
        }
      }
    `;

    const gqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    const raw = await gqlRes.text();

    console.log("🔑 Shopify endpoint:", graphqlEndpoint);
    console.log("🧾 Shopify raw response:", raw);

    if (!gqlRes.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw },
        { status: 400 }
      );
    }

    const parsed = JSON.parse(raw);
    const customer = parsed.data?.customer;

    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "No customer object returned", raw },
        { status: 404 }
      );
    }

    // 🪣 Sync with Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("customers").upsert({
      shopify_id: customer.id,
      email: customer.emailAddress?.emailAddress,
      first_name: customer.firstName,
      last_name: customer.lastName,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, customer });
  } catch (err: unknown) {
    console.error("🔥 Unexpected error in /api/shopify-sync:", err);
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 500 }
    );
  }
}