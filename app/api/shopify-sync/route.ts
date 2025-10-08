// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieJar = await cookies();
    const token = cookieJar.get("customer_access_token")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "No Shopify token" }, { status: 401 });
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const apiDiscovery = await fetch(`https://${shopDomain}/.well-known/customer-account-api`);
    const apiConfig = await apiDiscovery.json();
    const graphqlEndpoint = apiConfig.graphql_api;

    // Query the customer profile
    const query = `
      query getCustomer {
        customer {
          id
          emailAddress { emailAddress }
          firstName
          lastName
        }
      }
    `;

    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
const text = await res.text();
console.log("Shopify raw response:", text.slice(0, 300));
return NextResponse.json({ ok: false, raw: text }, { status: 400 });

    const json = await res.json();
    const customer = json.data?.customer;
    if (!customer) {
      console.error("Shopify query failed", json);
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    // Connect to Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { id: shopify_customer_id, emailAddress, firstName, lastName } = {
      id: customer.id,
      emailAddress: customer.emailAddress?.emailAddress,
      firstName: customer.firstName,
      lastName: customer.lastName,
    };

    // Upsert customer record
    const { data, error } = await supabase
      .from("shopify_customers")
      .upsert(
        {
          shopify_customer_id,
          email: emailAddress,
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shopify_customer_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, customer: data });
  } catch (err) {
    console.error("Shopify sync error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
