import { NextResponse } from "next/server";
import {
  discoverAuthConfig,
  generateCodeChallenge,
  generateCodeVerifier,
} from "@/lib/shopifyAuth";

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export async function GET() {
  const shopDomain = getEnv("NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN");
  const clientId = getEnv("NEXT_PUBLIC_SHOPIFY_CUSTOMER_API_CLIENT_ID");
  const redirectUri = getEnv("NEXT_PUBLIC_REDIRECT_URI");

  const authConfig = await discoverAuthConfig(shopDomain);

  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  const state = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const nonce = Math.random().toString(36).slice(2, 12);

  const authUrl = new URL(authConfig.authorization_endpoint);
  authUrl.searchParams.append("scope", "openid email customer-account-api:full");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("nonce", nonce);
  authUrl.searchParams.append("prompt", "none");
  authUrl.searchParams.append("code_challenge", challenge);
  authUrl.searchParams.append("code_challenge_method", "S256");
  authUrl.searchParams.append("locale", "en");

  const response = NextResponse.redirect(authUrl.toString(), {
    status: 302,
  });

  const cookieConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 300,
  };

  response.cookies.set("pkce_verifier", verifier, cookieConfig);
  response.cookies.set("oauth_state", state, cookieConfig);
  response.cookies.set("oauth_nonce", nonce, cookieConfig);

  return response;
}
