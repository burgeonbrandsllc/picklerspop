import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface Customer {
  id?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: { emailAddress?: string };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No customer_access_token cookie found" },
        { status: 401 }
      );
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!; // e.g. picklerspop.com
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

    // --- Discover GraphQL endpoint ---
    const discoveryUrl = `https://${shopDomain}/.well-known/customer-account-api`;
    const discoveryRes = await fetch(discoveryUrl);
    if (!discoveryRes.ok) {
      const text = await discoveryRes.text();
      return NextResponse.json(
        { ok: false, error: `Discovery failed: ${text}` },
        { status: 500 }
      );
    }

    const apiConfig: { graphql_api: string } = await discoveryRes.json();
    let graphqlEndpoint = apiConfig.graphql_api;

    // Force correct "account" subdomain for GraphQL
    if (graphqlEndpoint.includes("https://picklerspop.com")) {
      graphqlEndpoint = graphqlEndpoint.replace(
        "https://picklerspop.com",
        "https://account.picklerspop.com"
      );
    }

    console.log("✅ GraphQL endpoint:", graphqlEndpoint);

    // --- Prepare Shopify token ---
    const cleanToken = token.trim().replace(/^"+|"+$/g, "");
    const finalToken = cleanToken.startsWith("shcat_")
      ? cleanToken
      : `shcat_${cleanToken.replace(/^shcat_/, "")}`;

    console.log("🔑 Shopify token prefix:", finalToken.slice(0, 20));

    // --- GraphQL Query ---
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

    // --- Shopify GraphQL Request ---
    const graphqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalToken}`,
        "User-Agent": "picklerspop (https://picklerspop.com)",
        Origin: "https://account.picklerspop.com",
        Referer: "https://account.picklerspop.com",
      },
      body: JSON.stringify({ query }),
    });

    const raw = await graphqlRes.text();
    console.log("🧾 Shopify raw response:", raw.slice(0, 300));

    if (!graphqlRes.ok) {
      return NextResponse.json({ ok: false, raw }, { status: graphqlRes.status });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON from Shopify", raw },
        { status: 500 }
      );
    }

    const dataObj = json as { data?: { customer?: Customer }; errors?: unknown[] };

    if (dataObj.errors?.length) {
      console.error("❌ Shopify returned errors:", dataObj.errors);
      return NextResponse.json({ ok: false, raw: JSON.stringify(dataObj.errors) }, { status: 400 });
    }

    const customer = dataObj.data?.customer;
    if (!customer) {
      return NextResponse.json({ ok: false, raw }, { status: 404 });
    }

    // --- Upsert to Supabase ---
    const { data, error } = await supabase
      .from("customers")
      .upsert({
        shopify_id: String(customer.id ?? ""),
        first_name: String(customer.firstName ?? ""),
        last_name: String(customer.lastName ?? ""),
        email: String(customer.emailAddress?.emailAddress ?? ""),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase upsert error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("✅ Synced customer:", data?.email);
    return NextResponse.json({ ok: true, customer: data });
  } catch (error) {
    console.error("💥 /api/shopify-sync failed:", error);
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
