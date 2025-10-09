// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("customer_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, reason: "No customer_access_token found" },
        { status: 401 }
      );
    }

    // Discover the GraphQL endpoint dynamically
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const discovery = await fetch(`https://${shopDomain}/.well-known/customer-account-api`);
    const config = await discovery.json();
    const graphqlEndpoint = config.graphql_api || `https://${shopDomain}/customer/api/graphql`;

    // Query Shopify Customer Account API
    const gqlQuery = {
      query: `
        query {
          customer {
            id
            firstName
            lastName
            emailAddress { emailAddress }
          }
        }
      `,
    };

    const gqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(gqlQuery),
    });

    const raw = await gqlRes.text();

    if (!gqlRes.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw },
        { status: 400 }
      );
    }

    const data = JSON.parse(raw);
    const customer = data.data?.customer;
    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "No customer data", raw },
        { status: 404 }
      );
    }

    // Push to Supabase
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
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, customer });
  } catch (err: unknown) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 500 }
    );
  }
}