import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!; // e.g., picklerspop.com
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const authorizeEndpoint = "https://account.picklerspop.com/authentication/oauth/authorize";

  // Dynamically detect origin
  const reqUrl = new URL(request.url);
  const currentHost = reqUrl.hostname;
  const isProd = currentHost.endsWith("picklerspop.com");
  const redirectUri = isProd
    ? "https://picklerspop.com/api/callback"
    : "https://picklerspop.vercel.app/api/callback";

  const state = crypto.randomBytes(8).toString("hex");
  const nonce = crypto.randomBytes(8).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("hex");

  // PKCE challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = Buffer.from(digest)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Store values in secure cookies
  const cookieStore = await cookies();
  cookieStore.set("pkce_verifier", codeVerifier, { httpOnly: true, secure: true });
  cookieStore.set("oauth_state", state, { httpOnly: true, secure: true });
  cookieStore.set("oauth_nonce", nonce, { httpOnly: true, secure: true });
  cookieStore.set("oauth_back", "/", { httpOnly: true, secure: true });

  // Build redirect URL
  const authUrl = new URL(authorizeEndpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "none");
  authUrl.searchParams.set("locale", "en");

  console.log("🌐 Redirecting to:", authUrl.toString());

  return NextResponse.redirect(authUrl.toString(), { status: 302 });
}
