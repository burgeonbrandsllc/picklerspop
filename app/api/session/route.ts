// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("customer_access_token")?.value;
  if (!token) {
    return NextResponse.json(
      { authenticated: false, reason: "No access token found in cookies. Try /api/login" },
      { status: 401 }
    );
  }
  return NextResponse.json({ authenticated: true });
}
