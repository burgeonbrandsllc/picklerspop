import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const verifier = cookieStore.get("pkce_verifier")?.value;
    const storedState = cookieStore.get("oauth_state")?.value;

    if (!verifier || state !== storedState) {
      return NextResponse.json(
        { error: "State or verifier mismatch" },
        { status: 400 }
      );
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const clientId = process.env.SHOPIFY_CLIENT_ID!;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI!;

    // Discover token endpoint
    const discovery = await fetch(
      `https://${shopDomain}/.well-known/openid-configuration`
    );
    const config = await discovery.json();

    const tokenEndpoint = config.token_endpoint;
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("client_id", clientId);
    body.append("redirect_uri", redirectUri);
    body.append("code", code);
    body.append("code_verifier", verifier);

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("TOKEN ERROR:", text);
      return NextResponse.json({ error: text }, { status: 401 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const idToken = tokenData.id_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token returned" },
        { status: 401 }
      );
    }

    // ✅ Construct response with cookies attached
    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set("customer_access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".picklerspop.com",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    response.cookies.set("id_token", idToken ?? "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".picklerspop.com",
      maxAge: 60 * 60 * 24 * 7,
    });

    console.log("✅ Customer access token stored successfully");

    return response;
  } catch (err) {
    console.error("CALLBACK ERROR:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
