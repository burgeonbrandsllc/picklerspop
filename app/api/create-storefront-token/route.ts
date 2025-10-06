import { NextResponse } from "next/server";

export async function POST() {
  const shop = process.env.SHOPIFY_SHOP!;
  const adminToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;

  const mutation = `
    mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
      storefrontAccessTokenCreate(input: $input) {
        userErrors {
          field
          message
        }
        storefrontAccessToken {
          accessToken
          accessScopes {
            handle
          }
          title
        }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: { title: "Generated Storefront Access Token" },
      },
    }),
  });

  const json = await response.json();

  if (json.data?.storefrontAccessTokenCreate?.storefrontAccessToken) {
    return NextResponse.json({
      success: true,
      token: json.data.storefrontAccessTokenCreate.storefrontAccessToken.accessToken,
      scopes: json.data.storefrontAccessTokenCreate.storefrontAccessToken.accessScopes,
    });
  }

  console.error("Error creating Storefront token:", json);
  return NextResponse.json({ success: false, error: json }, { status: 500 });
}
