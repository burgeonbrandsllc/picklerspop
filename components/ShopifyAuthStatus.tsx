"use client";

import { useEffect, useState } from "react";

function navigateTopLevel(url: string) {
  try {
    window.top?.location.assign(url);
  } catch {
    window.location.assign(url);
  }
}

export default function ShopifyAuthStatus() {
  const [status, setStatus] = useState("Checking Shopify authentication...");

  useEffect(() => {
    const isLocalAuthDisabled =
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_DISABLE_SHOPIFY_AUTH === "true";

    if (isLocalAuthDisabled) {
      setStatus("Shopify authentication disabled for local development.");
      return;
    }

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

        const data: { authenticated?: boolean; reason?: string } =
          await res.json();

        // A missing/expired session is an expected authentication state, not
        // a failed session-check request. Start the Shopify OAuth flow.
        if (res.status === 401 || !data.authenticated) {
          if (!cancelled) {
            setStatus("Requesting Shopify session...");
            navigateTopLevel(`/api/login?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`Session check failed (${res.status})`);
        }
        if (cancelled) return;

        setStatus("Authenticated with Shopify Customer Account API");
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
    <div className="text-base text-gray-600" aria-live="polite">
      {status}
    </div>
  );
}
