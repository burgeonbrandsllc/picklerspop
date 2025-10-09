"use client";

import { useEffect, useState } from "react";

export default function ShopifyCustomerFetcher() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/shopify-sync");
        const json = await res.json();
        if (!json.ok) throw new Error(json.reason);

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

        const shopifyJson = await shopifyRes.json();
        setData(shopifyJson);
      } catch (err: any) {
        console.error(err);
        setError(String(err));
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