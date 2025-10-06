import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

type ShopifyCustomer = {
  id: string;
  email: string;
};

type ShopifySessionResult =
  | { authenticated: true; customer: ShopifyCustomer }
  | { authenticated: false; reason: string };

type SuccessResponse = {
  authenticated: true;
  customer: ShopifyCustomer;
  user: User;
  session: Pick<Session, "access_token" | "refresh_token" | "expires_in" | "expires_at" | "token_type">;
};

type FailureResponse = {
  authenticated: false;
  reason: string;
};

const SHOPIFY_SESSION_PATH = "/api/shopify-session";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function fetchShopifySession(request: NextRequest): Promise<ShopifySessionResult> {
  const origin = request.nextUrl.origin;
  const url = new URL(SHOPIFY_SESSION_PATH, origin);
  const cookieHeader = request.headers.get("cookie") ?? "";

  const response = await fetch(url, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      authenticated: false,
      reason: `Shopify session request failed with ${response.status}`,
    };
  }

  if (payload?.authenticated) {
    return payload as ShopifySessionResult;
  }

  return {
    authenticated: false,
    reason: payload?.reason ?? "Shopify session unavailable",
  };
}

function derivePassword(shopifyId: string, secretSeed: string): string {
  const hash = createHash("sha256")
    .update(`${shopifyId}:${secretSeed}`)
    .digest("hex");
  return hash.slice(0, 64); // at least 6 characters, deterministic per customer
}

async function findUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<User | null> {
  const normalized = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const match = users.find((user) =>
      user.email ? user.email.toLowerCase() === normalized : false
    );

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseServiceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const customerAccountSeed = requiredEnv("SHOPIFY_CUSTOMER_ACCOUNT_TOKEN");

    const shopifySession = await fetchShopifySession(request);

    if (!shopifySession.authenticated) {
      return NextResponse.json<FailureResponse>(
        {
          authenticated: false,
          reason: shopifySession.reason,
        },
        { status: 401 }
      );
    }

    const customer = shopifySession.customer;
    const password = derivePassword(customer.id, customerAccountSeed);

    const adminClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let authUser: User | null = null;
    const { data: created, error: createError } = await adminClient.auth.admin
      .createUser({
        email: customer.email,
        password,
        email_confirm: true,
        user_metadata: {
          shopify_customer_id: customer.id,
        },
      });

    if (createError) {
      const duplicateUser =
        createError.status === 400 ||
        createError.status === 422 ||
        /already\s+registered/i.test(createError.message ?? "");

      if (!duplicateUser) {
        console.error("Supabase admin createUser error:", createError);
        return NextResponse.json<FailureResponse>(
          {
            authenticated: false,
            reason: "Failed to provision Supabase user",
          },
          { status: 500 }
        );
      }

      authUser = await findUserByEmail(adminClient, customer.email);

      if (!authUser) {
        return NextResponse.json<FailureResponse>(
          {
            authenticated: false,
            reason: "Supabase user not found for existing Shopify account",
          },
          { status: 500 }
        );
      }

      const { data: updated, error: updateError } =
        await adminClient.auth.admin.updateUserById(authUser.id, {
          password,
          email: customer.email,
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata ?? {}),
            shopify_customer_id: customer.id,
          },
        });

      if (updateError) {
        console.error("Supabase admin updateUserById error:", updateError);
        return NextResponse.json<FailureResponse>(
          {
            authenticated: false,
            reason: "Failed to update Supabase user",
          },
          { status: 500 }
        );
      }

      authUser = updated.user ?? authUser;
    } else {
      authUser = created.user;
    }

    if (!authUser) {
      return NextResponse.json<FailureResponse>(
        {
          authenticated: false,
          reason: "Supabase user provisioning did not return a user",
        },
        { status: 500 }
      );
    }

    const { error: upsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: authUser.id,
          email: customer.email,
          shopify_customer_id: customer.id,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.warn("Failed to upsert users table entry:", upsertError);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email: customer.email,
        password,
      });

    if (signInError || !signInData.session || !signInData.user) {
      console.error("Supabase signInWithPassword error:", signInError);
      return NextResponse.json<FailureResponse>(
        {
          authenticated: false,
          reason: "Unable to establish Supabase session",
        },
        { status: 500 }
      );
    }

    const session = signInData.session;
    const responseBody: SuccessResponse = {
      authenticated: true,
      customer,
      user: signInData.user,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
      },
    };

    const response = NextResponse.json(responseBody, { status: 200 });

    const cookieClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    });

    await cookieClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    return response;
  } catch (error) {
    console.error("Error in /api/supabase-auth:", error);
    return NextResponse.json<FailureResponse>(
      {
        authenticated: false,
        reason: "Internal server error",
      },
      { status: 500 }
    );
  }
}
