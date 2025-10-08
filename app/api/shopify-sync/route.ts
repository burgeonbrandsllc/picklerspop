import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    // 🔐 Retrieve access token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No customer_access_token cookie found." },
        { status: 401 }
      );
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🧭 Discover Customer Account API endpoints
    const discovery = await fetch(`https://${shopDomain}/.well-known/customer-account-api`);
    if (!discovery.ok) {
      const text = await discovery.text();
      return NextResponse.json(
        { ok: false, error: `Discovery failed: ${text}` },
        { status: 500 }
      );
    }

    const apiConfig = await discovery.json();

    // ✅ Force correct account subdomain if discovery is wrong
    let graphqlEndpoint = apiConfig.graphql_api as string;
    if (graphqlEndpoint.includes("picklerspop.com/customer/api")) {
      graphqlEndpoint = graphqlEndpoint.replace(
        "https://picklerspop.com",
        "https://account.picklerspop.com"
      );
    }

    console.log("✅ Using Customer GraphQL endpoint:", graphqlEndpoint);

    // 🧼 Clean token & enforce Bearer prefix
    const cleanToken = token.trim().replace(/^"+|"+$/g, "");
    const authHeader = cleanToken.startsWith("shcat_")
      ? `Bearer ${cleanToken}`
      : `Bearer shcat_${cleanToken.replace(/^shcat_/, "")}`;

    console.log("🪪 Using Authorization header:", authHeader.slice(0, 40) + "...");

    // 🧠 Query Shopify Customer Account API for profile data
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

    const graphqlRes = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query }),
    });

    const raw = await graphqlRes.text();

    if (!graphqlRes.ok) {
      return NextResponse.json({ ok: false, raw }, { status: 403 });
    }

    const json = JSON.parse(raw);
    const customer = json?.data?.customer ?? null;

    if (!customer) {
      return NextResponse.json({ ok: false, raw }, { status: 404 });
    }

    // 🧾 Upsert into Supabase
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
      console.error("Supabase upsert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, customer: data });
  } catch (err) {
    console.error("Unexpected /shopify-sync error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
