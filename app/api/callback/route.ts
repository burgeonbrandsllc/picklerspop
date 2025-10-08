import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs"; // 👈 Force full Node.js runtime

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Shopify OAuth error:", error);
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

    // Discover the token endpoint
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
      console.error("Token error:", text);
      return NextResponse.json({ error: text }, { status: 401 });
    }

    const tokenData = await tokenRes.json();
    const { access_token, id_token } = tokenData;

    if (!access_token) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    // ✅ Construct redirect manually to preserve cookies
    const redirect = NextResponse.redirect(new URL("/", request.url));

    // Add secure, cross-domain cookies
    redirect.headers.append(
      "Set-Cookie",
      `customer_access_token=${access_token}; Path=/; HttpOnly; Secure; SameSite=None; Domain=.picklerspop.com; Max-Age=604800`
    );
    if (id_token) {
      redirect.headers.append(
        "Set-Cookie",
        `id_token=${id_token}; Path=/; HttpOnly; Secure; SameSite=None; Domain=.picklerspop.com; Max-Age=604800`
      );
    }

    console.log("✅ Tokens set and redirecting home.");
    return redirect;
  } catch (err) {
    console.error("Callback error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
