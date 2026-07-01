import type { Metadata, Viewport } from "next";
import { FontLinks } from "@m1kapp/kit";
import "./globals.css";
import Providers from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#c15f3c",
};
const DESC = "오늘도 같이 클로드 달려요 — 구독 본전을 얼마나 뽑는지 모두의 기록을 모아보는 곳. Running with Claude — everyone's value-for-money from their Claude subscription.";
export const metadata: Metadata = {
  metadataBase: new URL("https://clauderank.m1k.app"),
  title: "Claude Run · 같이 달리는 구독 가성비 / run together",
  description: DESC,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: { title: "Claude Run", description: DESC, url: "/", images: ["/og-image.png"], type: "website" },
  twitter: { card: "summary_large_image", title: "Claude Run", description: DESC, images: ["/og-image.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <FontLinks />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
