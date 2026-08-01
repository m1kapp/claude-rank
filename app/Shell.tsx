"use client";
import { useEffect, useState } from "react";
import { AppShell, AppShellHeader, AppShellContent, FetchProgress, Watermark } from "@m1kapp/kit";
import { useI18n } from "../lib/i18n";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { locale, toggle, t } = useI18n();
  // m1k.app 카운트를 same-origin 프록시로 받아 Watermark에 전달 (CORS 우회 → 푸터 카운트 슬라이더 작동)
  const [counts, setCounts] = useState<{ today: number; total: number } | undefined>(undefined);
  useEffect(() => {
    fetch("/api/visitors").then((r) => r.json()).then((d) => { if (d) setCounts({ today: d.today, total: d.total }); }).catch(() => {});
  }, []);
  return (
    <Watermark color="#100f12" text="claude run" maxWidth={430} speed={60} trackSlug="gs" claimed counts={counts}>
    <AppShell accent="#d4694a" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        {/* 셸 폭이 뷰포트와 별개로 고정이라, 부제 숨김은 미디어쿼리가 아니라 컨테이너 기준이어야 한다 */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", containerType: "inline-size" }}>
          <img src="/logo.svg" alt="Claude Run" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "contain", flex: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            {/* 브랜드는 절대 접히지 않게, 자리가 모자라면 페이지 부제가 먼저 잘린다. */}
            <span className="display" style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em", whiteSpace: "nowrap", flex: "none" }}>CLAUDE RUN</span>
            {/* 잘린 부제("RUN TOGE…")는 안 보이느니만 못하다 — 좁으면 통째로 숨긴다 */}
            <span className="page-sub display" style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</span>
          </div>
          {/* 블로그는 푸터 회색 12px 로는 모바일 폴드 아래라 사실상 안 보였다 — 헤더로 올린다. */}
          <a href="/blog" title={t("blog.h1")} aria-label="Blog"
            style={{ marginLeft: "auto", flex: "none", display: "flex", alignItems: "center", font: "inherit", textDecoration: "none", background: "transparent", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 10px", color: "var(--muted)" }}>
            <span className="display" style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.06em" }}>BLOG</span>
          </a>
          <button onClick={toggle} aria-label="Toggle language" title={locale === "ko" ? "Switch to English" : "한국어로 전환"}
            style={{ marginLeft: 6, flex: "none", display: "flex", alignItems: "center", gap: 4, font: "inherit", cursor: "pointer", background: "transparent", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 9px", color: "var(--muted)" }}>
            <span className="display" style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", color: locale === "ko" ? "var(--ink)" : "var(--muted)" }}>한</span>
            <span style={{ fontSize: 9, color: "var(--line)" }}>·</span>
            <span className="display" style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", color: locale === "en" ? "var(--ink)" : "var(--muted)" }}>EN</span>
          </button>
        </div>
      </AppShellHeader>
      {/* 백그라운드 재검증 스윕 로딩바 — useFetch 전역 활동 자동 감지 */}
      <FetchProgress top={56} height={2} color="var(--terra)" />
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
    </Watermark>
  );
}
