"use client";
import { ToastProvider } from "@m1kapp/kit";
export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
