import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        reason: "No access token found in cookies. Try hitting /api/login first.",
      },
      { status: 401 }
    );
  }

  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN!;
    const discoveryUrl = `https://${shop}/.well-known/customer-account-api`;
    const discoveryRes = await fetch(discoveryUrl);
    const discovery = await discoveryRes.json();
    const graphqlUrl = discovery.graphql_api;

    const verifyRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { customer { id emailAddress { emailAddress } } }`,
      }),
    });

    if (!verifyRes.ok) {
      const error = await verifyRes.text();
      return NextResponse.json(
        { authenticated: false, reason: `Shopify API returned ${verifyRes.status}`, error },
        { status: 401 }
      );
    }

    const data = await verifyRes.json();
    if (!data?.data?.customer) {
      return NextResponse.json(
        { authenticated: false, reason: "No customer returned from Shopify." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      customer: data.data.customer,
    });
    } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json(
      {
        authenticated: false,
        reason: "Internal error",
        error: errorMessage,
      },
      { status: 500 }
    );
  }

}
