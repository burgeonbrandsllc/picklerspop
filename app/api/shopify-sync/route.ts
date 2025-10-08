import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No access token in cookies" },
        { status: 401 }
      );
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const discovery = await fetch(
      `https://${shopDomain}/.well-known/customer-account-api`
    );

    if (!discovery.ok) {
      return NextResponse.json(
        { ok: false, error: "Customer API discovery failed" },
        { status: 500 }
      );
    }

    const apiConfig = await discovery.json();
    const graphqlEndpoint = apiConfig.graphql_api as string;

    // ✅ Query Shopify Customer Account API
    const query = `
      query {
        customer {
          firstName
          lastName
          emailAddress {
            emailAddress
          }
        }
      }
    `;

    const graphqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 👇 Must be "Bearer <token>" and token must start with "shcat_"
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const raw = await graphqlRes.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, raw }, { status: 502 });
    }

    if (!graphqlRes.ok || data.errors) {
      console.error("Shopify GraphQL error:", data);
      return NextResponse.json({ ok: false, raw }, { status: 400 });
    }

    const customer = data.data?.customer;
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "No customer in response" },
        { status: 404 }
      );
    }

    // ✅ Upsert into Supabase
    const { error } = await supabase.from("customers").upsert({
      email: customer.emailAddress?.emailAddress,
      first_name: customer.firstName,
      last_name: customer.lastName,
      last_synced_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, customer });
  } catch (err) {
    console.error("shopify-sync exception:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
