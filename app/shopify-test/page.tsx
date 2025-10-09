"use client";

import { useEffect, useState } from "react";

interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface ShopifyResponse {
  data?: { customer?: ShopifyCustomer };
  errors?: { message: string }[];
}

export default function ShopifyCustomerFetcher() {
  const [data, setData] = useState<ShopifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/shopify-sync");
        const json: { ok: boolean; token?: string; reason?: string } = await res.json();
        if (!json.ok || !json.token) throw new Error(json.reason || "Missing token");

        const token = json.token;

        // Now fetch from Shopify directly in the browser
        const shopifyRes = await fetch("https://picklerspop.com/customer/api/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query {
                customer {
                  id
                  email
                  firstName
                  lastName
                }
              }
            `,
          }),
        });

        const shopifyJson: ShopifyResponse = await shopifyRes.json();
        setData(shopifyJson);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
  }, []);

  if (error) return <pre style={{ color: "red" }}>Error: {error}</pre>;
  if (!data) return <p>Loading...</p>;

  return (
    <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}