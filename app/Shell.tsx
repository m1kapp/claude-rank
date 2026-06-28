"use client";
import { useEffect, useState } from "react";
import { AppShell, AppShellHeader, AppShellContent, Watermark } from "@m1kapp/kit";
import { useI18n } from "../lib/i18n";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { locale, toggle } = useI18n();
  // m1k.app 카운트를 same-origin 프록시로 받아 Watermark에 전달 (CORS 우회 → 푸터 카운트 슬라이더 작동)
  const [counts, setCounts] = useState<{ today: number; total: number } | undefined>(undefined);
  useEffect(() => {
    fetch("/api/visitors").then((r) => r.json()).then((d) => { if (d) setCounts({ today: d.today, total: d.total }); }).catch(() => {});
  }, []);
  return (
    <Watermark color="#100f12" text="claude run" maxWidth={430} speed={60} trackSlug="gs" claimed counts={counts}>
    <AppShell accent="#d4694a" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%" }}>
          <img src="/tiers/challenger.png" alt="" style={{ width: 26, height: 26, objectFit: "contain", flex: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            <span className="display" style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em" }}>CLAUDE RUN</span>
            <span className="display" style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>{title}</span>
          </div>
          <button onClick={toggle} aria-label="Toggle language" title={locale === "ko" ? "Switch to English" : "한국어로 전환"}
            style={{ marginLeft: "auto", flex: "none", display: "flex", alignItems: "center", gap: 4, font: "inherit", cursor: "pointer", background: "transparent", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 9px", color: "var(--muted)" }}>
            <span className="display" style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", color: locale === "ko" ? "var(--ink)" : "var(--muted)" }}>한</span>
            <span style={{ fontSize: 9, color: "var(--line)" }}>·</span>
            <span className="display" style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", color: locale === "en" ? "var(--ink)" : "var(--muted)" }}>EN</span>
          </button>
        </div>
      </AppShellHeader>
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
    </Watermark>
  );
}
