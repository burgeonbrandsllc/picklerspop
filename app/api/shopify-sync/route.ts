// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Sync Shopify Customer Data → Supabase
 * Clean pass-through of customer_access_token (no modification or prefixing)
 */
export async function GET() {
  try {
    // 1️⃣ Pull token directly from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "Missing customer_access_token" },
        { status: 401 }
      );
    }

    console.log("🔑 Using customer_access_token:", token.substring(0, 25) + "...");

    // 2️⃣ Discover the GraphQL endpoint dynamically
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || "account.picklerspop.com";
    const discoveryUrl = `https://${shopDomain}/.well-known/customer-account-api`;
    const discoveryRes = await fetch(discoveryUrl);

    if (!discoveryRes.ok) {
      const txt = await discoveryRes.text();
      console.error("❌ Failed to discover Shopify endpoint:", txt);
      return NextResponse.json({ ok: false, reason: "Discovery failed", raw: txt }, { status: 502 });
    }

    const discoveryData = await discoveryRes.json();
    const graphqlEndpoint = discoveryData.graphql_api;

    console.log("✅ GraphQL endpoint:", graphqlEndpoint);

    // 3️⃣ Build a sample query (you can expand this later)
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

    // 4️⃣ Fetch data from Shopify using the raw token (no prefix adjustments)
    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // 🚨 use as-is
      },
      body: JSON.stringify({ query }),
    });

    const raw = await res.text();
    console.log("🧾 Shopify raw response:", raw);

    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: "Shopify API error", raw }, { status: res.status });
    }

    const data = JSON.parse(raw);
    const customer = data?.data?.customer;

    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "No customer data returned", raw },
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

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return NextResponse.json({ ok: false, reason: "Supabase error", error }, { status: 500 });
    }

    // 6️⃣ Return success
    return NextResponse.json({
      ok: true,
      customer,
    });
  } catch (err) {
    console.error("💥 Shopify Sync failed:", err);
    return NextResponse.json(
      { ok: false, reason: "Internal error", error: String(err) },
      { status: 500 }
    );
  }
}