import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

export async function GET() {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const clientId = process.env.SHOPIFY_CLIENT_ID!;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI!;

    // Discover authentication endpoints dynamically
    const discoveryResponse = await fetch(
      `https://${shopDomain}/.well-known/openid-configuration`
    );
    const authConfig = await discoveryResponse.json();
    const authorizationEndpoint = authConfig.authorization_endpoint;

    // Build PKCE + state
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = Math.random().toString(36).substring(2, 15);
    const nonce = Math.random().toString(36).substring(2, 15);

    // ✅ FIX: Await cookies() before using
    const cookieStore = await cookies();
    cookieStore.set("pkce_verifier", codeVerifier, { httpOnly: true, secure: true });
    cookieStore.set("oauth_state", state, { httpOnly: true, secure: true });
    cookieStore.set("oauth_nonce", nonce, { httpOnly: true, secure: true });

    // Build authorization URL
    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("scope", "openid email customer-account-api:full");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("nonce", nonce);
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");
    authUrl.searchParams.append("prompt", "none");
    authUrl.searchParams.append("locale", "en");

    console.log("Redirecting to:", authUrl.toString());
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
