// app/api/shopify-login/route.ts
import { NextResponse } from "next/server";

const SHOPIFY_STORE_URL = "https://picklerspop.com/api/2025-01/graphql.json";
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN!;

/**
 * POST /api/shopify-login
 * Body: { email: string, password: string }
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 🧠 1. Call Shopify Storefront API to create a customer access token
    const query = `
      mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          customerUserErrors {
            field
            message
          }
        }
      }
    `;

    const response = await fetch(SHOPIFY_STORE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { input: { email, password } },
      }),
    });

    const { data, errors } = await response.json();

    if (errors || data?.customerAccessTokenCreate?.customerUserErrors?.length) {
      console.error("Shopify login error:", errors || data.customerAccessTokenCreate.customerUserErrors);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const tokenData = data.customerAccessTokenCreate.customerAccessToken;
    if (!tokenData?.accessToken) {
      return NextResponse.json(
        { error: "No token returned from Shopify" },
        { status: 500 }
      );
    }

    // 🧁 2. Set the cookie
    const res = NextResponse.json({
      success: true,
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
    });

    res.cookies.set("customer_access_token", tokenData.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      expires: new Date(tokenData.expiresAt),
    });

    return res;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Error in /api/shopify-login:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
