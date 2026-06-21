"use client";
import { AppShell, AppShellHeader, AppShellContent } from "@m1kapp/kit";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppShell accent="#d97757" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 17 }}>{title}</div>
      </AppShellHeader>
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
  );
}
