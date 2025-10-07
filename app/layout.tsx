import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/SupabaseProvider";
import ShopifyBridge from "@/components/ShopifyBridge"; // ✅ import bridge
import ShopifyAuthStatus from "@/components/ShopifyAuthStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PicklersPop",
  description: "Find and review pickleball facilities near you",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <ShopifyBridge /> {/* ✅ loads Shopify session */}
          <div className="px-4 py-2">
            <ShopifyAuthStatus />
          </div>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
