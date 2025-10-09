// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "No customer_access_token cookie found" },
        { status: 401 }
      );
    }

    const graphqlUrl = "https://picklerspop.com/customer/api/graphql";
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

    const shopifyRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const raw = await shopifyRes.text();

    if (!shopifyRes.ok) {
      return NextResponse.json(
        { ok: false, reason: "Shopify API error", status: shopifyRes.status, raw },
        { status: shopifyRes.status }
      );
    }

    return NextResponse.json({ ok: true, data: JSON.parse(raw) });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, reason: "Server exception", error: String(err) },
      { status: 500 }
    );
  }
}