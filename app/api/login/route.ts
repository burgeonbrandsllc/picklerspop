// app/api/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * Shopify Customer Account OAuth (PKCE + silent auth)
 * For use on app.picklerspop.com
 */
export async function GET() {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!; // account.picklerspop.com
    const clientId = process.env.SHOPIFY_CLIENT_ID!;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI!; // https://app.picklerspop.com/api/callback

    if (!shopDomain || !clientId || !redirectUri) {
      return new NextResponse("Missing environment variables", { status: 500 });
    }

    // ---- 1️⃣ PKCE verifier + challenge ----
    const codeVerifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(codeVerifier);

    // ---- 2️⃣ State + nonce ----
    const state = generateRandomString(16);
    const nonce = generateRandomString(16);

    // ---- 3️⃣ Store verifier + state + nonce ----
    const cookieStore = await cookies();
    cookieStore.set("pkce_verifier", codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    cookieStore.set("oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    cookieStore.set("oauth_nonce", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    // ---- 4️⃣ Discover from account.picklerspop.com ----
    const discoveryUrl = `https://${shopDomain}/.well-known/openid-configuration`;
    const discoveryRes = await fetch(discoveryUrl);

    if (!discoveryRes.ok) {
      const txt = await discoveryRes.text();
      return new NextResponse(`Discovery failed:\n${txt}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const config = await discoveryRes.json();
    const authorizationEndpoint = config.authorization_endpoint as string;

    // ---- 5️⃣ Build the authorization request ----
    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("prompt", "none");
    authUrl.searchParams.set("locale", "en");

    console.log("🔐 Redirecting to:", authUrl.toString());

    // ---- 6️⃣ Redirect user to Shopify login ----
    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    console.error("❌ /api/login failed:", err);
    return new NextResponse(`Login error:\n${String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

// ---------- Helpers ----------
function generateRandomString(length: number) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < randomValues.length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}