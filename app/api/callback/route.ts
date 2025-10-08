// app/api/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new NextResponse(
        `<pre>Shopify returned error: ${error}</pre>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }
    if (!code) {
      return new NextResponse(`<pre>Missing code</pre>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 400,
      });
    }

    const cookieStore = await cookies();
    const verifier = cookieStore.get("pkce_verifier")?.value;
    const storedState = cookieStore.get("oauth_state")?.value;
    const backCookie = cookieStore.get("oauth_back")?.value;

    if (!verifier || state !== storedState) {
      return new NextResponse(`<pre>State or verifier mismatch</pre>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 400,
      });
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const clientId = process.env.SHOPIFY_CLIENT_ID!;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI!;

    // Discover token endpoint
    const discovery = await fetch(`https://${shopDomain}/.well-known/openid-configuration`);
    if (!discovery.ok) {
      return new NextResponse(`<pre>Discovery failed</pre>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 500,
      });
    }
    const config = await discovery.json();
    const tokenEndpoint = config.token_endpoint as string;

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
      return new NextResponse(`<pre>Token error:\n${text}</pre>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 401,
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    const idToken = tokenData.id_token as string | undefined;

    if (!accessToken) {
      return new NextResponse(`<pre>No access token</pre>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 401,
      });
    }

    // Choose where to go next
    const backPath = backCookie && backCookie.startsWith("/") ? backCookie : "/";

    // Inline page: set tokens client-side, promote to HttpOnly via /api/set-session, then redirect.
    const html = `
<!doctype html>
<meta charset="utf-8" />
<title>Signing you in…</title>
<script>
(function(){
  var accessToken = ${JSON.stringify(accessToken)};
  var idToken = ${JSON.stringify(idToken || "")};
  var back = ${JSON.stringify(backPath)};

  try {
    // Local client storage (handy for client-only logic)
    localStorage.setItem("shopify_customer_access_token", accessToken);
    if (idToken) localStorage.setItem("shopify_id_token", idToken);

    // Session cookie the client can read immediately
    document.cookie = "customer_access_token=" + encodeURIComponent(accessToken) + "; Path=/; Secure; SameSite=Lax; Max-Age=604800";
    if (idToken) {
      document.cookie = "id_token=" + encodeURIComponent(idToken) + "; Path=/; Secure; SameSite=Lax; Max-Age=604800";
    }
  } catch (e) {}

  // Promote to HttpOnly server cookie for SSR/APIs
  fetch("/api/set-session", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ access_token: accessToken, id_token: idToken })
  }).finally(function(){
    window.location.replace(back);
  });
})();
</script>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(`<pre>Callback exception:\n${String(err)}</pre>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }
}
