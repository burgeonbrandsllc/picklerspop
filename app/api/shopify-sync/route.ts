// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, PostgrestError } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ShopifyGraphQLResponse {
  data?: { customer?: ShopifyCustomer };
  errors?: { message: string }[];
}

/**
 * Shopify Customer Sync → Supabase
 * Clean token passthrough + detailed debug logging
 */
export async function GET() {
  try {
    // 1️⃣ Get token directly from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      console.error("❌ Missing customer_access_token cookie");
      return NextResponse.json(
        { ok: false, reason: "Missing customer_access_token" },
        { status: 401 }
      );
    }

    console.log("🔑 Token prefix:", token.substring(0, 10));
    console.log("📏 Token length:", token.length);

    // 2️⃣ Discover Shopify API endpoints
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || "account.picklerspop.com";
    const discoveryUrl = `https://${shopDomain}/.well-known/customer-account-api`;

    const discoveryRes = await fetch(discoveryUrl);
    if (!discoveryRes.ok) {
      const txt = await discoveryRes.text();
      console.error("❌ Discovery failed:", txt);
      return NextResponse.json(
        { ok: false, reason: "Discovery failed", raw: txt },
        { status: discoveryRes.status }
      );
    }

    const discoveryData = (await discoveryRes.json()) as { graphql_api: string };
    const graphqlEndpoint = discoveryData.graphql_api;

    console.log("✅ GraphQL endpoint:", graphqlEndpoint);

    // 3️⃣ Build GraphQL query
    const query = `
      query GetCustomer {
        customer {
          id
          email
          firstName
          lastName
        }
      }
    `;

    // 4️⃣ Send request to Shopify — clean token passthrough
    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const rawText = await res.text();
    console.log("🧾 Shopify HTTP Status:", res.status);
    console.log("🧾 Shopify Headers:", Object.fromEntries(res.headers.entries()));
    console.log("🧾 Shopify Raw Response:", rawText);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw: rawText },
        { status: res.status }
      );
    }

    let json: ShopifyGraphQLResponse;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.warn("⚠️ Non-JSON Shopify response");
      return NextResponse.json(
        { ok: false, reason: "Invalid JSON from Shopify", raw: rawText },
        { status: 502 }
      );
    }

    if (json.errors && json.errors.length > 0) {
      console.error("❌ Shopify GraphQL errors:", json.errors);
      return NextResponse.json(
        { ok: false, reason: "GraphQL error", raw: json.errors },
        { status: 400 }
      );
    }

    const customer = json.data?.customer;
    if (!customer) {
      console.error("⚠️ No customer data returned:", json);
      return NextResponse.json(
        { ok: false, reason: "No customer returned", raw: json },
        { status: 404 }
      );
    }

    // 5️⃣ Upsert into Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("customers").upsert({
      id: customer.id,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      updated_at: new Date().toISOString(),
    });

    if (error as PostgrestError) {
      console.error("❌ Supabase upsert error:", error);
      return NextResponse.json({ ok: false, reason: "Supabase error", error }, { status: 500 });
    }

    console.log("✅ Customer synced:", customer.email);

    return NextResponse.json({
      ok: true,
      customer,
      debug: {
        tokenPrefix: token.substring(0, 10),
        graphqlEndpoint,
        status: res.status,
      },
    });
  } catch (err: unknown) {
    console.error("💥 Uncaught error in Shopify Sync:", err);
    return NextResponse.json(
      { ok: false, reason: "Internal server error", error: String(err) },
      { status: 500 }
    );
  }
}