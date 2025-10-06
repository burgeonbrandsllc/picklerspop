import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      `https://${process.env.SHOPIFY_SHOP}/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token":
            process.env.SHOPIFY_STOREFRONT_TOKEN || "",
        },
        body: JSON.stringify({
          query: `
            {
              customer {
                id
                email
                firstName
                lastName
              }
            }
          `,
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { authenticated: false, reason: "Shopify returned " + res.status },
        { status: res.status }
      );
    }

    const data: {
      data?: {
        customer?: {
          id: string;
          email: string;
          firstName?: string;
          lastName?: string;
        };
      };
    } = await res.json();

    const customer = data?.data?.customer;
    if (!customer) {
      return NextResponse.json(
        { authenticated: false, reason: "No active Shopify session" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      customer,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown internal error";
    return NextResponse.json(
      { authenticated: false, reason: "Internal error", error: message },
      { status: 500 }
    );
  }
}
