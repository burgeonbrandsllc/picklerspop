import { webcrypto } from "node:crypto";

const cryptoImpl = globalThis.crypto ?? webcrypto;

const textEncoder = new TextEncoder();

function toBase64Url(input: Uint8Array) {
  let base64 = Buffer.from(input).toString("base64");
  base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base64;
}

export async function discoverAuthConfig(shopDomain: string) {
  const response = await fetch(
    `https://${shopDomain}/.well-known/openid-configuration`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error("Failed to discover OpenID config");
  }
  return response.json();
}

export async function discoverCustomerAPI(shopDomain: string) {
  const response = await fetch(
    `https://${shopDomain}/.well-known/customer-account-api`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error("Failed to discover Customer Account API");
  }
  return response.json();
}

export async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  cryptoImpl.getRandomValues(array);
  return toBase64Url(array);
}

export async function generateCodeChallenge(verifier: string) {
  const hash = await cryptoImpl.subtle.digest(
    "SHA-256",
    textEncoder.encode(verifier),
  );
  return toBase64Url(new Uint8Array(hash));
}

type GraphQLRecord<T> = {
  data?: T;
  errors?: Array<{ message: string; [key: string]: unknown }>;
};

export async function customerGraphQLRequest<T>(
  shopDomain: string,
  accessToken: string,
  payload: { query: string; variables?: Record<string, unknown> } | string,
) {
  const apiConfig = await discoverCustomerAPI(shopDomain);

  const graphqlEndpoint =
    apiConfig.graphql?.endpoint ??
    apiConfig.graphql?.url ??
    apiConfig.graphql_url ??
    apiConfig.graphqlEndpoint;

  if (!graphqlEndpoint) {
    throw new Error("Unable to determine Shopify Customer Account GraphQL endpoint");
  }

  const body =
    typeof payload === "string"
      ? JSON.stringify({ query: payload })
      : JSON.stringify(payload);

  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Shopify Customer Account API request failed (${response.status}): ${text}`,
    );
  }

  return (await response.json()) as GraphQLRecord<T>;
}
