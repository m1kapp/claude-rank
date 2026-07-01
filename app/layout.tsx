import type { Metadata, Viewport } from "next";
import { FontLinks } from "@m1kapp/kit";
import "./globals.css";
import Providers from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};
export const metadata: Metadata = {
  title: "Claude Run · 같이 달리는 구독 가성비 / run together",
  description: "오늘도 같이 클로드 달려요 — 구독 본전을 얼마나 뽑는지 모두의 기록을 모아보는 곳. Running with Claude — a place that gathers everyone's value-for-money from their Claude subscription.",
  icons: { icon: "/logo.svg", apple: "/logo.svg" },
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
