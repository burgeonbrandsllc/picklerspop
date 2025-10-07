import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const token = cookies().get("customer_access_token")?.value;
  if (!token) {
    return NextResponse.json(
      { authenticated: false, reason: "No access token" },
      { status: 200 },
    );
  }

  return NextResponse.json({ authenticated: true }, { status: 200 });
}
