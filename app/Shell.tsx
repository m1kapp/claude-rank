"use client";
import { AppShell, AppShellHeader, AppShellContent } from "@m1kapp/kit";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppShell accent="#d97757" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        <div className="display" style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em" }}>{title}</div>
      </AppShellHeader>
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
  );
}
