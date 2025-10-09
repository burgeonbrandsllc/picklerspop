// app/api/shopify-sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_access_token")?.value;

  if (!token) {
    return NextResponse.json({ ok: false, reason: "No token found" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    token, // ⚠️ return token to client (browser)
  });
}