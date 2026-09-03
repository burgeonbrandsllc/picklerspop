import { NextRequest, NextResponse } from "next/server";

type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
};

function cleanLocation(value: string) {
  return value.replace(/[,()'\"]/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const location = cleanLocation(request.nextUrl.searchParams.get("q") ?? "");

  if (!location || location.length < 2 || /^\d+$/.test(location)) {
    return NextResponse.json(
      { error: "Enter a valid city or location." },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    q: `${location}, United States`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: "us",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "PicklersPop local development search",
        },
        next: { revalidate: 60 * 60 * 24 * 30 },
      }
    );

    if (!response.ok) {
      throw new Error(`Location lookup failed (${response.status})`);
    }

    const places = (await response.json()) as NominatimPlace[];
    const place = places[0];
    const latitude = Number(place?.lat);
    const longitude = Number(place?.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: "Location not found." },
        { status: 404 }
      );
    }

    const address = place.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.municipality ?? location;
    const label = [city, address.state].filter(Boolean).join(", ");

    return NextResponse.json({
      location,
      latitude,
      longitude,
      label: label || place.display_name || location,
    });
  } catch (error) {
    console.error("Failed to geocode location:", error);
    return NextResponse.json(
      { error: "Unable to locate that city right now." },
      { status: 502 }
    );
  }
}