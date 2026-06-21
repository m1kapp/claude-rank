import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude 구독 가성비 랭킹",
  description: "누가 Claude 구독 본전을 제일 뽑나 — usage-report 제출 랭킹",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
