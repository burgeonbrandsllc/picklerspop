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

    // ✅ The correct Customer Account API endpoint
    const graphqlEndpoint = "https://picklerspop.com/customer/api/graphql";
    console.log("✅ Shopify GraphQL endpoint:", graphqlEndpoint);

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

    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // token already includes shcat_
        Origin: "https://picklerspop.com",
        Referer: "https://picklerspop.com/",
        "User-Agent": "PicklersPop App (Next.js / Vercel)",
      },
      body: JSON.stringify({ query }),
    });

    // --- Log everything from Shopify ---
    const rawText = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));

    console.log("🧾 Shopify HTTP Status:", res.status);
    console.log("🧾 Shopify Headers:", JSON.stringify(headers, null, 2));
    console.log("🧾 Shopify Raw Response:", rawText);

    // --- Parse and handle ---
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", status: res.status, headers, raw: rawText },
        { status: res.status }
      );
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      return NextResponse.json(
        { ok: false, reason: "Invalid JSON response", raw: rawText },
        { status: 502 }
      );
    }

    if (data.errors?.length) {
      console.error("🛑 Shopify GraphQL errors:", data.errors);
      return NextResponse.json(
        { ok: false, reason: "GraphQL error", raw: data.errors },
        { status: 400 }
      );
    }

    const customer = data.data?.customer;
    if (!customer) {
      console.error("⚠️ No customer object returned.");
      return NextResponse.json(
        { ok: false, reason: "No customer returned", raw: data },
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

    console.log("✅ Customer synced successfully:", customer.email);

    return NextResponse.json({
      ok: true,
      customer,
      debug: { status: res.status, headers },
    });
  } catch (err) {
    console.error("💥 Uncaught error:", err);
    return NextResponse.json(
      { ok: false, reason: "Internal server error", error: String(err) },
      { status: 500 }
    );
  }
}