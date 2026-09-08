// app/api/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return startShopifyCustomerLogin(request, false);
}

export async function startShopifyCustomerLogin(request: Request, silentAuth: boolean) {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI;

    if (!shopDomain || !clientId || !redirectUri) {
      return new NextResponse("Missing environment variables", { status: 500 });
    }

    const requestUrl = new URL(request.url);
    const returnTo = requestUrl.searchParams.get("return_to");
    const referer = request.headers.get("referer");
    const backPath = getBackPath(returnTo, referer);

    const codeVerifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(16);
    const nonce = generateRandomString(16);

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
    cookieStore.set("oauth_back", backPath, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const discoveryRes = await fetch(
      `https://${shopDomain}/.well-known/openid-configuration`,
      { headers: { Accept: "application/json" } }
    );

    if (!discoveryRes.ok) {
      const txt = await discoveryRes.text();
      return new NextResponse(`Discovery failed:\n${txt}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const config = await discoveryRes.json();
    const authorizationEndpoint = config.authorization_endpoint as string;

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("locale", "en");

    if (silentAuth) {
      authUrl.searchParams.set("prompt", "none");
    }

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    console.error("/api/login failed:", err);
    return new NextResponse(`Login error:\n${String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function getBackPath(returnTo: string | null, referer: string | null) {
  if (returnTo?.startsWith("/")) return returnTo;

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}` || "/";
    } catch {
      return "/";
    }
  }

  return "/";
}

function generateRandomString(length: number) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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