import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type PlayerProfilePayload = {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  zip_code?: string;
  rating?: string;
  location?: string;
  gender?: string;
};

const PROFILE_COLUMNS = [
  "player_id",
  "username",
  "email",
  "first_name",
  "last_name",
  "mobile_number",
  "zip_code",
  "rating",
  "location",
  "gender",
  "created_at",
  "updated_at",
].join(",");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getShopifyCustomerId(user: {
  user_metadata?: Record<string, unknown>;
}) {
  const value = user.user_metadata?.shopify_customer_id;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function findPlayerId(
  adminClient: SupabaseClient,
  shopifyCustomerId: string
) {
  const { data, error } = await adminClient
    .from("shopify_customers")
    .select("player_id")
    .eq("shopify_customer_id", shopifyCustomerId)
    .maybeSingle();

  if (error) throw error;
  return data?.player_id ?? null;
}

async function getRequestContext(request: NextRequest) {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("authorization") ?? "";

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData.user) {
    return {
      response: NextResponse.json(
        { reason: "Sign in before editing your player profile." },
        { status: 401 }
      ),
    };
  }

  const shopifyCustomerId = getShopifyCustomerId(userData.user);
  if (!shopifyCustomerId) {
    return {
      response: NextResponse.json(
        { reason: "Shopify customer ID is missing for this user." },
        { status: 409 }
      ),
    };
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const playerId = await findPlayerId(adminClient, shopifyCustomerId);

  if (!playerId) {
    return {
      response: NextResponse.json(
        { reason: "Player account has not been synchronized yet." },
        { status: 409 }
      ),
    };
  }

  return { adminClient, playerId, user: userData.user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    if ("response" in context) return context.response;

    const { data, error } = await context.adminClient
      .from("player_attributes")
      .select(PROFILE_COLUMNS)
      .eq("player_id", context.playerId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error("Error in GET /api/player-profile:", error);
    return NextResponse.json(
      { reason: "Unable to load player profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    if ("response" in context) return context.response;

    const body = (await request.json().catch(() => ({}))) as PlayerProfilePayload;
    const profile = {
      player_id: context.playerId,
      username: cleanText(body.username),
      email: cleanText(body.email) || context.user.email,
      first_name: cleanText(body.first_name),
      last_name: cleanText(body.last_name),
      mobile_number: cleanText(body.mobile_number),
      zip_code: cleanText(body.zip_code),
      rating: cleanText(body.rating),
      location: cleanText(body.location),
      gender: cleanText(body.gender),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await context.adminClient
      .from("player_attributes")
      .upsert(profile, { onConflict: "player_id" })
      .select(PROFILE_COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Error in PUT /api/player-profile:", error);
    return NextResponse.json(
      { reason: "Unable to save player profile." },
      { status: 500 }
    );
  }
}
