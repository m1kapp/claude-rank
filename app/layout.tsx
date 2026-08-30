import type { Metadata, Viewport } from "next";
import { KitStyles } from "@m1kapp/kit/pwa";
import "./globals.css";
import Providers from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#c8ff5a",
};
const DESC = "Claude Code와 Codex를 한 러너 아래 연결하고, 각 에이전트를 얼마나 끝까지 돌렸는지 기록하는 리그. One runner, two agent lanes.";
export const metadata: Metadata = {
  metadataBase: new URL("https://runmaxing.m1k.app"),
  title: "runmaxing · keep your agents running",
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
  openGraph: { title: "runmaxing", description: DESC, url: "/", images: [{ url: "/og.png", width: 1200, height: 630, alt: "runmaxing · keep your agents running" }], type: "website" },
  twitter: { card: "summary_large_image", title: "runmaxing", description: DESC, images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <KitStyles />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
