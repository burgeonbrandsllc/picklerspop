import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false, reason: "No customer token" });
    }

    const apiDiscovery = await fetch(`https://${shopDomain}/.well-known/customer-account-api`);
    const apiConfig = await apiDiscovery.json();

    const response = await fetch(apiConfig.graphql_api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        query: `query { customer { id email firstName lastName } }`,
      }),
    });

    const data = await response.json();
    const customer = data?.data?.customer;

    if (customer) {
      return NextResponse.json({ authenticated: true, customer });
    } else {
      return NextResponse.json({ authenticated: false, reason: "Invalid token" });
    }
  } catch (error: any) {
    console.error("Shopify session check failed", error);
    return NextResponse.json({ authenticated: false, reason: "Error", error: error.message });
  }
}
