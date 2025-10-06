import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.SHOPIFY_CUSTOMER_API_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;

  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Get verifier from cookie
  const cookieStore = await cookies();
  const verifier = cookieStore.get("pkce_verifier")?.value;
  if (!verifier) return NextResponse.json({ error: "Missing verifier" }, { status: 400 });

  // Discover token endpoint dynamically
  const discovery = await fetch(`https://${shopDomain}/.well-known/openid-configuration`);
  const config = await discovery.json();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });

  const tokenResponse = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("Token exchange failed", tokenData);
    return NextResponse.json({ error: "Token exchange failed", tokenData }, { status: 401 });
  }

  const res = NextResponse.redirect("/");
  res.cookies.set("customer_access_token", tokenData.access_token, {
    httpOnly: true,
    secure: true,
    path: "/",
  });

  return res;
}
