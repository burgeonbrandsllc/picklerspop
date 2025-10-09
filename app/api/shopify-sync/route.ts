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

    // ✅ Ensure correct prefix
    const accessToken = token.startsWith("shcat_") ? token : `shcat_${token}`;

    console.log("🧩 Token prefix:", accessToken.slice(0, 12));
    console.log("📏 Token length:", accessToken.length);

    // ✅ Correct Customer Account API endpoint (domain-scoped)
    const graphqlEndpoint =
      "https://account.picklerspop.com/customer/api/graphql";

    // ✅ Shopify customer query
    const query = `
      query {
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

    const gqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Shopify-Store-Domain": "picklerspop.com",
      },
      body: JSON.stringify({ query }),
    });

    const raw = await gqlRes.text();
    console.log("🔑 Shopify endpoint:", graphqlEndpoint);
    console.log("🧾 Shopify raw response:", raw);

    if (!gqlRes.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", raw },
        { status: gqlRes.status }
      );
    }

    const parsed = JSON.parse(raw);
    const customer = parsed?.data?.customer;

    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "No customer object returned", raw },
        { status: 404 }
      );
    }

    // ✅ Optional: sync to Supabase
    try {
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
        return NextResponse.json(
          { ok: false, reason: "Supabase error", details: error.message },
          { status: 500 }
        );
      }
    } catch (dbErr) {
      console.error("⚠️ Supabase connection failed:", dbErr);
      // Continue anyway
    }

    return NextResponse.json({ ok: true, customer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("🔥 Unexpected error in /api/shopify-sync:", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 }
    );
  }
}