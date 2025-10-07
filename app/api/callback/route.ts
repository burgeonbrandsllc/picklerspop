import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { discoverAuthConfig } from "@/lib/shopifyAuth";

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function clearTemporaryCookies(response: NextResponse) {
  const expiredConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("pkce_verifier", "", expiredConfig);
  response.cookies.set("oauth_state", "", expiredConfig);
  response.cookies.set("oauth_nonce", "", expiredConfig);
}

export async function GET(request: Request) {
  const shopDomain = getEnv("NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN");
  const clientId = getEnv("NEXT_PUBLIC_SHOPIFY_CUSTOMER_API_CLIENT_ID");
  const clientSecret = getEnv("SHOPIFY_CUSTOMER_API_CLIENT_SECRET");
  const redirectUri = getEnv("NEXT_PUBLIC_REDIRECT_URI");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = cookies();
  const verifier = cookieStore.get("pkce_verifier")?.value;
  const storedState = cookieStore.get("oauth_state")?.value;

  if (error === "login_required") {
    const response = NextResponse.redirect(
      "https://picklerspop.com/login?shopify=login_required",
      { status: 302 },
    );
    clearTemporaryCookies(response);
    return response;
  }

  if (error) {
    const response = NextResponse.redirect(
      `https://picklerspop.com/login?shopify_error=${encodeURIComponent(
        error,
      )}`,
      { status: 302 },
    );
    clearTemporaryCookies(response);
    return response;
  }

  if (!code || !verifier) {
    return NextResponse.json(
      { authenticated: false, reason: "Missing code or verifier" },
      { status: 400 },
    );
  }

  if (!state || storedState !== state) {
    return NextResponse.json(
      { authenticated: false, reason: "Invalid OAuth state" },
      { status: 400 },
    );
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
    Authorization:
      "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
  };

  const tokenRes = await fetch(authConfig.token_endpoint, {
    method: "POST",
    headers,
    body,
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    const response = NextResponse.redirect(
      "https://picklerspop.com/login?shopify=token_exchange_failed",
      { status: 302 },
    );
    clearTemporaryCookies(response);
    return response;
  }

  const accessToken = tokenData.access_token as string | undefined;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const idToken = tokenData.id_token as string | undefined;
  const expiresIn = Number(tokenData.expires_in) || 3600;

  const response = NextResponse.redirect("https://picklerspop.com/account", {
    status: 302,
  });

  const secureCookieConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
  };

  if (accessToken) {
    response.cookies.set("customer_access_token", accessToken, {
      ...secureCookieConfig,
      maxAge: expiresIn,
    });
  }

  if (refreshToken) {
    // Shopify typically provides refresh tokens that last 6 months.
    const refreshTtl = Number(tokenData.refresh_token_expires_in) || 60 * 60 * 24 * 180;
    response.cookies.set("customer_refresh_token", refreshToken, {
      ...secureCookieConfig,
      maxAge: refreshTtl,
    });
  }

  if (idToken) {
    response.cookies.set("customer_id_token", idToken, {
      ...secureCookieConfig,
      maxAge: expiresIn,
    });
  }

  clearTemporaryCookies(response);

  return response;
}
