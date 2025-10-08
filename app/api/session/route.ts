// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const include = url.searchParams.get("include"); // "token" to include token

  const cookieStore = await cookies();
  const token = cookieStore.get("customer_access_token")?.value ?? null;
  const idToken = cookieStore.get("id_token")?.value ?? null;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, reason: "No access token" },
      { status: 401 }
    );
  }

  // Only expose tokens to the client when explicitly requested
  if (include === "token") {
    return NextResponse.json({
      authenticated: true,
      token,
      id_token: idToken ?? undefined,
    });
  }

  return NextResponse.json({ authenticated: true });
}