"use client";
import { ToastProvider } from "@m1kapp/kit";
import { I18nProvider } from "../lib/i18n";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
