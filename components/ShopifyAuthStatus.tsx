"use client";

import { useEffect, useState } from "react";

type AuthState = "checking" | "authenticated" | "needs-login" | "local-disabled" | "error";

function getLoginUrl() {
  if (typeof window === "undefined") return "/api/login";

  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/api/login?return_to=${encodeURIComponent(returnTo)}`;
}

export default function ShopifyAuthStatus() {
  const [status, setStatus] = useState("Checking Shopify authentication...");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [loginUrl, setLoginUrl] = useState("/api/login");

  useEffect(() => {
    setLoginUrl(getLoginUrl());

    const isLocalAuthDisabled =
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_DISABLE_SHOPIFY_AUTH === "true";

    if (isLocalAuthDisabled) {
      setAuthState("local-disabled");
      setStatus("Shopify authentication disabled for local development.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const loginRequired = params.get("shopify") === "login_required";
    const callbackError = params.get("shopify_error");

    if (loginRequired) {
      setAuthState("needs-login");
      setStatus("Shopify session required.");
      return;
    }

    if (callbackError) {
      setAuthState("error");
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

        if (res.status === 401 || !data.authenticated) {
          if (!cancelled) {
            setAuthState("needs-login");
            setStatus("Shopify session required.");
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`Session check failed (${res.status})`);
        }
        if (cancelled) return;

        setAuthState("authenticated");
        setStatus("Authenticated with Shopify Customer Account API");
      } catch (err) {
        console.error("Failed to check Shopify session", err);
        if (!cancelled) {
          setAuthState("error");
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
    <div className="space-y-3 text-base text-gray-600" aria-live="polite">
      <div>{status}</div>
      {authState === "needs-login" ? (
        <a
          href={loginUrl}
          target="_top"
          className="inline-flex rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Sign in with Shopify
        </a>
      ) : null}
    </div>
  );
}