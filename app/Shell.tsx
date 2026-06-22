"use client";
import { AppShell, AppShellHeader, AppShellContent } from "@m1kapp/kit";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppShell accent="#d97757" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%" }}>
          <img src="/tiers/challenger.png" alt="" style={{ width: 26, height: 26, objectFit: "contain", flex: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            <span className="display" style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em" }}>CLAUDE RANK</span>
            <span className="display" style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>{title}</span>
          </div>
        </div>
      </AppShellHeader>
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
  );
}
