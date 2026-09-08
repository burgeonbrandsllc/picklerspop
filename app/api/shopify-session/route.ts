import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { customerGraphQLRequest } from "@/lib/shopifyAuth";

type CustomerQueryResult = {
  customer?: {
    id?: string;
    emailAddress?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

const CUSTOMER_QUERY = `
  query CurrentCustomer {
    customer {
      id
      emailAddress
      firstName
      lastName
    }
  }
`;

export async function GET() {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN ?? process.env.SHOPIFY_SHOP;

    if (!shopDomain) {
      return NextResponse.json(
        { authenticated: false, reason: "SHOPIFY_SHOP_DOMAIN is not configured" },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("customer_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { authenticated: false, reason: "No active Shopify session" },
        { status: 401 }
      );
    }

    const data = await customerGraphQLRequest<CustomerQueryResult>(
      shopDomain,
      accessToken,
      { query: CUSTOMER_QUERY }
    );

    if (data.errors?.length) {
      console.error("Shopify Customer Account API errors:", data.errors);
      return NextResponse.json(
        { authenticated: false, reason: "Shopify customer lookup failed" },
        { status: 401 }
      );
    }

    const customer = data.data?.customer;
    const email = customer?.emailAddress ?? customer?.email;

    if (!customer?.id || !email) {
      return NextResponse.json(
        { authenticated: false, reason: "No active Shopify customer" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      customer: {
        id: customer.id,
        email,
        firstName: customer.firstName ?? undefined,
        lastName: customer.lastName ?? undefined,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown internal error";
    console.error("Failed to load Shopify session:", error);
    return NextResponse.json(
      { authenticated: false, reason: "Internal error", error: message },
      { status: 500 }
    );
  }
}