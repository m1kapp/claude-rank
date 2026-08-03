"use client";
import { useEffect, useState } from "react";
import { AppShell, AppShellHeader, AppShellContent, FetchProgress, Watermark, TabBar, Tab } from "@m1kapp/kit";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { locale, toggle, t } = useI18n();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const onLab = pathname.startsWith("/blog");
  const [counts, setCounts] = useState<{ today: number; total: number } | undefined>();

  useEffect(() => {
    fetch("/api/visitors").then((r) => r.json()).then((d) => {
      if (d) setCounts({ today: d.today, total: d.total });
    }).catch(() => {});
  }, []);

  return (
    <Watermark color="#080a08" text="runmaxing · keep running" maxWidth={460} speed={54} trackSlug="gs" claimed counts={counts}>
      <AppShell accent="#c8ff5a" maxHeight={960} style={{ height: "var(--shell-h)" }}>
        <AppShellHeader>
          <div className="brand-header">
            <button className="brand-home" onClick={() => router.push("/")} aria-label="runmaxing home">
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
              <span className="brand-word">runmaxing</span>
            </button>
            {title && <span className="page-sub">/{title.toLowerCase()}</span>}
            <span className="header-live"><i />live</span>
            <button className="lang-toggle" onClick={toggle} aria-label="Toggle language" title={locale === "ko" ? "Switch to English" : "한국어로 전환"}>
              <span className={locale === "ko" ? "active" : ""}>한</span>
              <span>·</span>
              <span className={locale === "en" ? "active" : ""}>EN</span>
            </button>
          </div>
        </AppShellHeader>
        <FetchProgress top={56} height={2} color="var(--signal)" />
        <AppShellContent>{children}</AppShellContent>
        <TabBar>
          <Tab active={!onLab} onClick={() => router.push("/")} icon="🏁" label={t("nav.league")} activeColor="var(--signal)" />
          <Tab active={onLab} onClick={() => router.push("/blog")} icon="⌁" label={t("nav.lab")} activeColor="var(--signal)" />
        </TabBar>
      </AppShell>
    </Watermark>
  );
}
