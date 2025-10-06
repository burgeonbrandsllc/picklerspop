import { NextResponse } from "next/server";

/**
 * This proxy fetches the Shopify account page HTML from your customer domain.
 * It prevents CORS errors in the browser by doing it server-side.
 */
export async function GET() {
  try {
    const targetUrl = "https://account.picklerspop.com/?locale=en&region_country=US";

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "PicklersPopApp",
        "Accept": "text/html",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Shopify proxy failed:", res.status, text.slice(0, 200));
      return NextResponse.json(
        { success: false, status: res.status, error: "Shopify proxy error" },
        { status: res.status }
      );
    }

    const html = await res.text();

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Shopify proxy unexpected error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
