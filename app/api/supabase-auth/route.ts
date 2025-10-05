import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const customerAccessToken = (await cookieStore).get("customer_access_token")?.value;

  if (!customerAccessToken) {
    return NextResponse.json({ authenticated: false, reason: "No Shopify session" });
  }

  // ✅ Validate the Shopify customer access token
  const shopifyResponse = await fetch(
    `https://${process.env.SHOPIFY_DOMAIN}/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token":
          process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query: `
          query {
            customer(customerAccessToken: "${customerAccessToken}") {
              id
              email
              firstName
              lastName
            }
          }
        `,
      }),
    }
  );

  const result = await shopifyResponse.json();
  const customer = result.data?.customer;

  if (!customer?.email) {
    return NextResponse.json({ authenticated: false, reason: "Invalid Shopify token" });
  }

  const email = customer.email;
  const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();

  // ✅ Create or fetch a Supabase user (via Service Role)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users, error: lookupError } = await supabaseAdmin
    .from("auth.users")
    .select("id, email")
    .eq("email", email)
    .limit(1);

  if (lookupError) {
    console.error("Lookup error:", lookupError);
    return NextResponse.json({ authenticated: false });
  }

  let userId: string;

  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, source: "shopify" },
    });

    if (createError || !newUser?.user) {
      console.error("Create user error:", createError);
      return NextResponse.json({ authenticated: false });
    }

    userId = newUser.user.id;
  }

  // ✅ Generate Supabase session cookie
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: () => cookieStore }
  );

  const { data: jwt, error: jwtError } = await supabase.auth.admin.createJwt({
    sub: userId,
    email,
  });

  if (jwtError || !jwt?.token) {
    console.error("JWT creation failed:", jwtError);
    return NextResponse.json({ authenticated: false });
  }

  // Store Supabase tokens in cookies
  cookieStore.set("sb-access-token", jwt.token, { httpOnly: true, secure: true });
  cookieStore.set("sb-refresh-token", jwt.token, { httpOnly: true, secure: true });

  console.log(`✅ Linked Shopify customer ${email} → Supabase user ${userId}`);

  return NextResponse.json({
    authenticated: true,
    user: { id: userId, email, fullName },
  });
}
