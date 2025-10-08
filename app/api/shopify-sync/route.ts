import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    // --- Get cookie token ---
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No customer_access_token cookie found" },
        { status: 401 }
      );
    }

    // --- Env vars ---
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Discover Customer Account API endpoints ---
    const discoveryRes = await fetch(`https://${shopDomain}/.well-known/customer-account-api`);
    if (!discoveryRes.ok) {
      const text = await discoveryRes.text();
      return NextResponse.json(
        { ok: false, error: `Discovery failed: ${text}` },
        { status: 500 }
      );
    }

    const apiConfig = await discoveryRes.json();

    // --- Prefer correct account subdomain ---
    let graphqlEndpoint = apiConfig.graphql_api as string;
    if (graphqlEndpoint.includes("picklerspop.com/customer/api")) {
      graphqlEndpoint = graphqlEndpoint.replace(
        "https://picklerspop.com",
        "https://account.picklerspop.com"
      );
    }

    console.log("✅ GraphQL endpoint:", graphqlEndpoint);

    // --- Clean token ---
    const cleanToken = token.trim().replace(/^"+|"+$/g, "");
    const finalToken = cleanToken.startsWith("shcat_")
      ? cleanToken
      : `shcat_${cleanToken.replace(/^shcat_/, "")}`;
    const authHeader = `Bearer ${finalToken}`;

    console.log("🔑 Shopify token prefix:", finalToken.slice(0, 20));

    // --- Build query ---
    const query = `
      query GetCustomer {
        customer {
          id
          firstName
          lastName
          emailAddress {
            emailAddress
          }
        }
      }
    `;

    // --- Perform GraphQL call ---
    const graphqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "User-Agent": "picklerspop (https://picklerspop.com)",
        Origin: "https://picklerspop.com",
      },
      body: JSON.stringify({ query }),
    });

    const raw = await graphqlRes.text();

    // --- Debug output ---
    console.log("🧾 Shopify raw response:", raw.slice(0, 300));

    if (!graphqlRes.ok) {
      return NextResponse.json({ ok: false, raw }, { status: graphqlRes.status });
    }

    // --- Parse response safely ---
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      return NextResponse.json({ ok: false, error: "Invalid JSON from Shopify", raw }, { status: 500 });
    }

    const customer = json?.data?.customer ?? null;
    if (!customer) {
      return NextResponse.json({ ok: false, raw }, { status: 404 });
    }

    // --- Upsert into Supabase ---
    const { data, error } = await supabase
      .from("customers")
      .upsert({
        shopify_id: customer.id,
        first_name: customer.firstName ?? null,
        last_name: customer.lastName ?? null,
        email: customer.emailAddress?.emailAddress ?? null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("✅ Synced customer:", data?.email);
    return NextResponse.json({ ok: true, customer: data });
  } catch (err) {
    console.error("💥 /api/shopify-sync failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
