// app/api/login/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// --- PKCE helpers ---
function randomString(len = 32) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}
function base64Url(bytes: Uint8Array) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+/g, "");
}
async function pkce() {
  const verifier = base64Url(await sha256(randomString(32))); // strong random-ish
  const challenge = base64Url(await sha256(verifier));
  return { verifier, challenge };
}

export async function GET(request: Request) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;        // e.g. account.picklerspop.com
  const clientId   = process.env.SHOPIFY_CLIENT_ID!;          // from Customer Accounts app
  const redirectUri= process.env.SHOPIFY_REDIRECT_URI!;       // e.g. https://picklerspop.vercel.app/api/callback

  const url = new URL(request.url);
  const interactive = url.searchParams.get("interactive");
  const back = url.searchParams.get("back") || "/";

  // Discover endpoints
  const discoveryRes = await fetch(`https://${shopDomain}/.well-known/openid-configuration`);
  if (!discoveryRes.ok) {
    return NextResponse.json({ error: "Discovery failed" }, { status: 500 });
  }
  const authConfig = await discoveryRes.json();
  const authorizeEndpoint = authConfig.authorization_endpoint as string;

  const state = randomString(16);
  const nonce = randomString(16);
  const { verifier, challenge } = await pkce();

  const authUrl = new URL(authorizeEndpoint);
  authUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("locale", "en");
  if (interactive !== "1") authUrl.searchParams.set("prompt", "none");

  // Set cookies and redirect
  const res = NextResponse.redirect(authUrl.toString());
  // These can be HttpOnly (server reads them on callback)
  res.cookies.set("pkce_verifier", verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  res.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  res.cookies.set("oauth_nonce", nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  // Non-HttpOnly so client can read as fallback (optional)
  res.cookies.set("oauth_back", back, { httpOnly: false, secure: true, sameSite: "lax", path: "/" });

  return res;
}
