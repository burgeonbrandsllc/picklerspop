// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // ✅ Fix: await cookies()
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, reason: "No access token" },
      { status: 401 }
    );
  }

  return NextResponse.json({ authenticated: true }, { status: 200 });
}
