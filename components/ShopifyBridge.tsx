"use client";
import { useEffect } from "react";

export default function ShopifyBridge() {
  useEffect(() => {
    // Safely handle message events from Shopify
    const handleShopifyMessage = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data
      ) {
        const msg = event.data as { type: string; payload?: unknown };

        if (msg.type === "shopify:customer_session") {
          console.log("Received customer session payload:", msg.payload);
        }
      }
    };

    window.addEventListener("message", handleShopifyMessage);
    return () => window.removeEventListener("message", handleShopifyMessage);
  }, []);

  return null;
}
