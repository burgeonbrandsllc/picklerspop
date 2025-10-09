// app/api/debug-token/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "No customer_access_token cookie" },
        { status: 401 }
      );
    }

    // Token should start with "shcat_"
    if (!token.startsWith("shcat_")) {
      return NextResponse.json(
        { ok: false, reason: "Token missing shcat_ prefix", tokenPrefix: token.substring(0, 10) },
        { status: 400 }
      );
    }

    // Remove Shopify's prefix
    const jwt = token.replace(/^shcat_/, "");
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ ok: false, reason: "Malformed JWT" }, { status: 400 });
    }

    // Decode payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );

    const claims = {
      iss: payload.iss,
      aud: payload.aud,
      exp: new Date(payload.exp * 1000).toISOString(),
      iat: new Date(payload.iat * 1000).toISOString(),
      shopId: payload.shopId || payload.shop_id,
      email: payload.email,
      email_verified: payload.email_verified,
      sub: payload.sub,
      raw: payload,
    };

    console.log("🔍 Token claims:", claims);

    return NextResponse.json({ ok: true, claims });
  } catch (err) {
    console.error("❌ Token decode failed:", err);
    return NextResponse.json(
      { ok: false, reason: "Decode failed", error: String(err) },
      { status: 500 }
    );
  }
}