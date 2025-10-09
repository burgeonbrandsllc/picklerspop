// app/api/set-session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { access_token, id_token } = await req.json();
    if (!access_token) {
      return NextResponse.json({ ok: false, reason: "Missing access_token" }, { status: 400 });
    }

    const cookieStore = await cookies();

    cookieStore.set("customer_access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    if (id_token) {
      cookieStore.set("id_token", id_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 500 }
    );
  }
}