// app/api/set-session/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { access_token, id_token } = (await req.json().catch(() => ({}))) as {
      access_token?: string;
      id_token?: string;
    };

    if (!access_token) {
      return NextResponse.json({ ok: false, error: "missing access_token" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });

    // If you have a custom domain for the app, set APP_COOKIE_DOMAIN (e.g. app.picklerspop.com)
    const domain = process.env.APP_COOKIE_DOMAIN || undefined;

    res.cookies.set("customer_access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      domain,
      maxAge: 60 * 60 * 24 * 7,
    });

    if (id_token) {
      res.cookies.set("id_token", id_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        domain,
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    // Optional: clear temp OAuth cookies so they don't linger
    res.cookies.set("pkce_verifier", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_nonce", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_back", "", { path: "/", maxAge: 0 });

    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
