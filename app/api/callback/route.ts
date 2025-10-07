// app/api/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discoverAuthConfig } from "@/lib/shopifyAuth";

export async function GET(request: Request) {
  const shopDomain = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CUSTOMER_API_CLIENT_ID!;
  const clientSecret = process.env.SHOPIFY_CUSTOMER_API_CLIENT_SECRET!;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // ✅ Fix: Await cookies()
  const cookieStore = await cookies();
  const verifier = cookieStore.get("pkce_verifier")?.value;
  const storedState = cookieStore.get("oauth_state")?.value;

  if (error === "login_required") {
    return NextResponse.json({ authenticated: false, reason: "Login required" });
  }

  if (!code || !verifier) {
    return NextResponse.json({ authenticated: false, reason: "Missing code or verifier" });
  }

  const authConfig = await discoverAuthConfig(shopDomain);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
  };

  const tokenRes = await fetch(authConfig.token_endpoint, {
    method: "POST",
    headers,
    body,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokenData });
  }

  const res = NextResponse.redirect("https://picklerspop.com/account");
  res.cookies.set("customer_access_token", tokenData.access_token, { httpOnly: true, secure: true, path: "/" });
  res.cookies.set("customer_refresh_token", tokenData.refresh_token, { httpOnly: true, secure: true, path: "/" });
  return res;
}
