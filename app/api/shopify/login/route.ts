import { NextResponse } from "next/server";

export async function GET() {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.SHOPIFY_CUSTOMER_API_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;

  // Discover authentication endpoints dynamically
  const discovery = await fetch(`https://${shopDomain}/.well-known/openid-configuration`);
  const config = await discovery.json();

  // Generate random PKCE verifier and challenge
  const verifier = Buffer.from(crypto.randomUUID()).toString("base64url");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Buffer.from(new Uint8Array(digest)).toString("base64url");

  const authUrl = new URL(config.authorization_endpoint);
  authUrl.searchParams.append("scope", "openid email customer-account-api:full");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("state", crypto.randomUUID());
  authUrl.searchParams.append("nonce", crypto.randomUUID());
  authUrl.searchParams.append("code_challenge", challenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  // Set the verifier in a secure cookie
  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("pkce_verifier", verifier, { httpOnly: true, secure: true, path: "/" });
  return res;
}
