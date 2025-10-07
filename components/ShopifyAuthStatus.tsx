"use client";

import { useEffect, useState } from "react";

export default function ShopifyAuthStatus() {
  const [status, setStatus] = useState("Checking Shopify authentication...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginRequired = params.get("shopify") === "login_required";
    const callbackError = params.get("shopify_error");

    if (loginRequired) {
      setStatus("Shopify session required - please sign in.");
      return;
    }

    if (callbackError) {
      setStatus(`Shopify sign-in error: ${callbackError}`);
      return;
    }

    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Session check failed (${res.status})`);
        }
        const data: { authenticated?: boolean } = await res.json();
        if (cancelled) return;

        if (!data.authenticated) {
          setStatus("Requesting Shopify session...");
          window.location.href = "/api/login";
        } else {
          setStatus("Authenticated with Shopify Customer Account API");
        }
      } catch (err) {
        console.error("Failed to check Shopify session", err);
        if (!cancelled) {
          setStatus("Unable to verify Shopify session.");
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="text-sm text-gray-600" aria-live="polite">
      {status}
    </div>
  );
}
