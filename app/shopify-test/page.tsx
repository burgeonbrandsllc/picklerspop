"use client";

import { useEffect, useState } from "react";

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface GraphQLResponse {
  data?: { customer?: Customer };
  errors?: { message: string }[];
}

export default function ShopifyCustomerFetcher() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomer(): Promise<void> {
      try {
        // Step 1: Get the token from your backend
        const res = await fetch("/api/shopify-sync");
        const json: { ok: boolean; token?: string; reason?: string } = await res.json();
        if (!json.ok || !json.token) throw new Error(json.reason || "Missing token");

        const token = json.token;

        // Step 2: Call Shopify from the browser
        const graphql = "https://picklerspop.com/customer/api/graphql";
        const query = `
          query {
            customer {
              id
              email
              firstName
              lastName
            }
          }
        `;

        const shopifyRes = await fetch(graphql, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query }),
        });

        if (!shopifyRes.ok) throw new Error(`Shopify HTTP ${shopifyRes.status}`);
        const data: GraphQLResponse = await shopifyRes.json();

        if (data.errors?.length) {
          throw new Error(data.errors.map(e => e.message).join(", "));
        }

        if (!data.data?.customer) throw new Error("No customer object returned");

        setCustomer(data.data.customer);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    loadCustomer();
  }, []);

  if (error) return <pre style={{ color: "red" }}>Error: {error}</pre>;
  if (!customer) return <p>Loading customer data...</p>;

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h3>Customer Profile</h3>
      <pre>{JSON.stringify(customer, null, 2)}</pre>
    </div>
  );
}