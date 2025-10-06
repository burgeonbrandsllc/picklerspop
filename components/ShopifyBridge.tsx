"use client";

import { useEffect } from "react";

/**
 * ShopifyBridge attempts to detect a logged-in Shopify customer
 * on your Shopify storefront pages and syncs basic info (email, id)
 * into localStorage for the Next.js app to use.
 */
export default function ShopifyBridge() {
  useEffect(() => {
    try {
      const shopifyCustomer =
        (window as any)?.Shopify?.customer ||
        (window as any)?.ShopifyAnalytics?.meta?.page?.customer ||
        null;

      if (shopifyCustomer) {
        console.log("✅ Shopify customer detected:", shopifyCustomer);
        localStorage.setItem(
          "shopifyCustomer",
          JSON.stringify(shopifyCustomer)
        );
      } else {
        console.log("ℹ️ No active Shopify session found.");
        localStorage.removeItem("shopifyCustomer");
      }
    } catch (err) {
      console.error("⚠️ ShopifyBridge error:", err);
    }
  }, []);

  return null;
}
