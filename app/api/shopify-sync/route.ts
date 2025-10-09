// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

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

    // ✅ Correct endpoint for customer account API
    const graphqlEndpoint = "https://picklerspop.com/customer/api/graphql";
    console.log("✅ Using GraphQL endpoint:", graphqlEndpoint);

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

    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Origin": "https://picklerspop.com",
        "Referer": "https://picklerspop.com/",
      },
      body: JSON.stringify({ query }),
    });

    const rawText = await res.text();
    console.log("🧾 Shopify HTTP Status:", res.status);
    console.log("🧾 Shopify Raw Response:", rawText);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw: rawText },
        { status: res.status }
      );
    }

    const json = JSON.parse(rawText);

    if (json.errors?.length) {
      console.error("🛑 Shopify GraphQL errors:", json.errors);
      return NextResponse.json(
        { ok: false, reason: "GraphQL error", raw: json.errors },
        { status: 400 }
      );
    }

    const customer = json.data?.customer;
    if (!customer) {
      console.error("⚠️ No customer object returned.");
      return NextResponse.json(
        { ok: false, reason: "No customer returned", raw: json },
        { status: 404 }
      );
    }

    // ✅ Sync to Supabase
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

    console.log("✅ Customer synced:", customer.email);

    return NextResponse.json({
      ok: true,
      customer,
      debug: { graphqlEndpoint, status: res.status },
    });
  } catch (err) {
    console.error("💥 Uncaught error in Shopify Sync:", err);
    return NextResponse.json(
      { ok: false, reason: "Internal server error", error: String(err) },
      { status: 500 }
    );
  }
}