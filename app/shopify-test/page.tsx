"use client";

import React, { useEffect, useState } from "react";

// --- Types for clarity ---
interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface ShopifyData {
  data?: {
    customer?: Customer;
  };
  errors?: { message: string }[];
}

interface ApiResponse {
  ok: boolean;
  data?: ShopifyData;
  reason?: string;
}

export default function ShopifyTestPage(): React.ReactElement {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomer(): Promise<void> {
      try {
        const res = await fetch("/api/shopify-sync");
        const json: ApiResponse = await res.json();

        if (!json.ok) throw new Error(json.reason || "Shopify sync failed");

        const customerData = json.data?.data?.customer;
        if (!customerData) throw new Error("No customer returned");

        setCustomer(customerData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError(String(err));
      }
    }

    fetchCustomer();
  }, []);

  if (error) return <pre style={{ color: "red" }}>Error: {error}</pre>;
  if (!customer) return <p>Loading customer data...</p>;

  return (
    <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      <h3>🧾 Shopify Customer</h3>
      {JSON.stringify(customer, null, 2)}
    </div>
  );
}