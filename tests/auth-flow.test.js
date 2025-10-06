import assert from "node:assert";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const shopifyCookie = process.env.SHOPIFY_SESSION_COOKIE;

const authHeaders = shopifyCookie
  ? { cookie: shopifyCookie }
  : undefined;

async function fetchJson(path, init) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(authHeaders ?? {}),
    },
  });

  const body = await res.json().catch(() => ({
    parseError: true,
  }));

  return { res, body };
}

async function run() {
  console.log(`➡️  Testing Shopify session @ ${baseUrl}`);
  const { res: shopifyRes, body: shopifyBody } = await fetchJson(
    "/api/shopify-session"
  );

  assert.strictEqual(
    shopifyRes.status,
    200,
    `Expected 200 from /api/shopify-session, received ${shopifyRes.status}`
  );
  assert.ok(
    Object.hasOwn(shopifyBody, "authenticated"),
    "Response from /api/shopify-session missing 'authenticated' flag"
  );

  if (shopifyBody.authenticated) {
    console.log("✅ Shopify session detected", shopifyBody.customer);
  } else {
    console.warn("⚠️  Shopify session not detected", shopifyBody.reason);
    console.warn(
      "    Provide SHOPIFY_SESSION_COOKIE env var with Shopify customer cookies"
    );
  }

  console.log("➡️  Testing Supabase bridge @ /api/supabase-auth");
  const { res: supabaseRes, body: supabaseBody } = await fetchJson(
    "/api/supabase-auth",
    { method: "POST" }
  );

  const expectedStatus = shopifyBody.authenticated ? 200 : 401;
  assert.strictEqual(
    supabaseRes.status,
    expectedStatus,
    `Expected ${expectedStatus} from /api/supabase-auth, received ${supabaseRes.status}`
  );

  if (supabaseBody.authenticated) {
    assert.ok(supabaseBody.user?.id, "Supabase user id missing in bridge response");
    assert.ok(
      supabaseBody.session?.access_token,
      "Supabase session missing access_token"
    );
    console.log("✅ Supabase bridge created session for", supabaseBody.user.email);
  } else {
    console.warn("ℹ️  Supabase bridge declined request", supabaseBody.reason);
  }

  console.log("✅ API smoke tests finished");
}

run().catch((error) => {
  console.error("❌ Auth flow test failed", error);
  process.exitCode = 1;
});
