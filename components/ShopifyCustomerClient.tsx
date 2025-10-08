// components/ShopifyCustomerClient.tsx
"use client";

import { useEffect, useState } from "react";

type Maybe<T> = T | null | undefined;

interface CustomerNode {
  id?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: { emailAddress?: string };
}

interface GraphQLError {
  message: string;
}

interface CustomerAPIResponse {
  data?: { customer?: CustomerNode };
  errors?: GraphQLError[];
}

const SHOP_DOMAIN = "picklerspop.com";              // storefront domain
const ACCOUNT_DOMAIN = "account.picklerspop.com";   // account subdomain

function readCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp("(^| )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]+)")
  );
  return m ? decodeURIComponent(m[2]) : null;
}

export default function ShopifyCustomerClient({
  autoSync = true,
}: { autoSync?: boolean }) {
  const [status, setStatus] = useState<string>("idle");
  const [customer, setCustomer] = useState<Maybe<CustomerNode>>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("checking-session");

        // 1) Try to get token from readable cookie first
        let token = readCookie("customer_access_token");

        // 2) If not present (or HttpOnly), ask server to include token
        if (!token) {
          const res = await fetch("/api/session?include=token", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) {
            throw new Error(`Session API failed (${res.status})`);
          }
          const json: { authenticated?: boolean; token?: string } = await res.json();
          if (!json.authenticated || !json.token) {
            throw new Error("No customer token available");
          }
          token = json.token;
        }

        // 3) Discover Customer Account API endpoint from the storefront domain
        setStatus("discovering");
        const discRes = await fetch(
          `https://${SHOP_DOMAIN}/.well-known/customer-account-api`,
          { method: "GET", mode: "cors", credentials: "omit", cache: "no-store" }
        );
        if (!discRes.ok) {
          throw new Error(`Discovery failed (${discRes.status})`);
        }
        const discJson: { graphql_api: string } = await discRes.json();
        let graphqlEndpoint = discJson.graphql_api;

        // Force the account subdomain if needed (some shops return vanity domain)
        if (graphqlEndpoint.includes(`https://${SHOP_DOMAIN}`)) {
          graphqlEndpoint = graphqlEndpoint.replace(
            `https://${SHOP_DOMAIN}`,
            `https://${ACCOUNT_DOMAIN}`
          );
        }

        // 4) Call Shopify Customer Account GraphQL **from the browser**
        setStatus("querying-customer");
        const query = `
          query GetCustomer {
            customer {
              id
              firstName
              lastName
              emailAddress { emailAddress }
            }
          }
        `;

        const gqlRes = await fetch(graphqlEndpoint, {
          method: "POST",
          mode: "cors",
          credentials: "omit", // do NOT send our app cookies
          headers: {
            "Content-Type": "application/json",
            // IMPORTANT: Customer Account token must have the shcat_ prefix
            Authorization: `Bearer ${token.startsWith("shcat_") ? token : `shcat_${token}`}`,
          },
          body: JSON.stringify({ query }),
        });

        const rawText = await gqlRes.text();

        if (!gqlRes.ok) {
          throw new Error(`Shopify GraphQL failed (${gqlRes.status}): ${rawText}`);
        }

        let gqlJson: CustomerAPIResponse;
        try {
          gqlJson = JSON.parse(rawText) as CustomerAPIResponse;
        } catch {
          throw new Error("Invalid JSON from Shopify GraphQL");
        }

        if (gqlJson.errors?.length) {
          throw new Error(gqlJson.errors.map(e => e.message).join("; "));
        }

        const node = gqlJson.data?.customer;
        if (!node?.id) {
          throw new Error("No customer in response");
        }
        if (cancelled) return;

        setCustomer(node);
        setStatus("got-customer");

        // 5) Optionally upsert into Supabase through a server route
        if (autoSync) {
          setStatus("syncing-supabase");
          const upsertRes = await fetch("/api/upsert-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: node.id,
              email: node.emailAddress?.emailAddress ?? "",
              firstName: node.firstName ?? "",
              lastName: node.lastName ?? "",
            }),
          });
          if (!upsertRes.ok) {
            const t = await upsertRes.text();
            throw new Error(`Supabase upsert failed (${upsertRes.status}): ${t}`);
          }
          setStatus("done");
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [autoSync]);

  return (
    <div className="border rounded p-3 text-sm">
      <div className="font-medium mb-1">Shopify Customer Fallback (Client)</div>
      <div>Status: {status}</div>
      {error && <div className="text-red-600 mt-1">Error: {error}</div>}
      {customer && (
        <pre className="mt-2 whitespace-pre-wrap break-words">
{JSON.stringify(
  {
    id: customer.id,
    email: customer.emailAddress?.emailAddress ?? "",
    firstName: customer.firstName ?? "",
    lastName: customer.lastName ?? "",
  },
  null,
  2
)}
        </pre>
      )}
    </div>
  );
}