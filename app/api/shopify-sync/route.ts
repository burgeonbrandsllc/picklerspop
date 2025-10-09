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
        { ok: false, reason: "Missing customer_access_token" },
        { status: 401 }
      );
    }

    console.log("🔑 Token prefix:", token.substring(0, 10));
    console.log("📏 Token length:", token.length);

    // ✅ Correct endpoint — note the domain
    const graphqlEndpoint = "https://picklerspop.com/api/2025-01/graphql.json";

    // Shopify expects a POST with JSON body and correct headers
    const query = `
      query {
        customer {
          id
          email
          firstName
          lastName
        }
      }
    `;

    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // this token already has the `shcat_` prefix
        Authorization: `Bearer ${token}`,
        // Shopify requires a storefront header for cross-origin calls
        "Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
        Origin: "https://picklerspop.com",
      },
      body: JSON.stringify({ query }),
    });

    const raw = await response.text();
    console.log("🧾 Shopify HTTP Status:", response.status);
    console.log("🧾 Shopify Raw Response:", raw);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw },
        { status: response.status }
      );
    }

    const data = JSON.parse(raw);
    if (data.errors) {
      return NextResponse.json(
        { ok: false, reason: "GraphQL error", raw: data.errors },
        { status: 400 }
      );
    }

    const customer = data.data?.customer;
    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "No customer found", raw: data },
        { status: 404 }
      );
    }

    // ✅ Upsert into Supabase
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
      return NextResponse.json(
        { ok: false, reason: "Supabase error", error },
        { status: 500 }
      );
    }

    console.log("✅ Customer synced successfully:", customer.email);

    return NextResponse.json({ ok: true, customer });
  } catch (err) {
    console.error("💥 Uncaught error:", err);
    return NextResponse.json(
      { ok: false, reason: "Internal server error", error: String(err) },
      { status: 500 }
    );
  }
}