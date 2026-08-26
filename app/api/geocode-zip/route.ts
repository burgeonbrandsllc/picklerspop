import { NextRequest, NextResponse } from "next/server";

type ZipLookupResponse = {
  places?: Array<{
    latitude?: string;
    longitude?: string;
  }>;
};

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip")?.trim() ?? "";

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "Enter a valid five-digit US ZIP code." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (response.status === 404) {
      return NextResponse.json(
        { error: "ZIP code not found." },
        { status: 404 }
      );
    }

    if (!response.ok) {
      throw new Error(`ZIP lookup failed (${response.status})`);
    }

    const data = (await response.json()) as ZipLookupResponse;
    const place = data.places?.[0];
    const latitude = Number(place?.latitude);
    const longitude = Number(place?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("ZIP lookup returned invalid coordinates");
    }

    return NextResponse.json({ zip, latitude, longitude });
  } catch (error) {
    console.error("Failed to geocode ZIP code:", error);
    return NextResponse.json(
      { error: "Unable to locate that ZIP code right now." },
      { status: 502 }
    );
  }
}
