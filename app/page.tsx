"use client";
import { useState } from "react";
import { useFetch, Section, Select, EmptyState, Skeleton, Button } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import { tierForKrw, tierName } from "../lib/tier";
import { useI18n } from "../lib/i18n";

type MonthStat = { ratio: number; chats: number; commits: number; cost_krw: number; plan: number };
type Entry = { id: string; nick: string; plan: number; ratio: number; chats: number; commits: number; cost_krw: number; updated?: string; months?: Record<string, MonthStat> };

// 제출 시각 → KST "M/D HH:MM"
function fmtKST(iso?: string) {
  if (!iso) return "";
  const pt = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${+pt.month}/${+pt.day} ${pt.hour}:${pt.minute}`;
}


export default function Home() {
  const { t, locale, won, monthLabel } = useI18n();
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard");
  const router = useRouter();
  const entries = data?.entries ?? [];

  const monthSet = new Set<string>();
  entries.forEach((e) => Object.keys(e.months || {}).forEach((m) => monthSet.add(m)));
  const months = [...monthSet].sort().reverse();
  const options = months.map((m) => ({ value: m, label: monthLabel(m) }));
  const [selRaw, setSel] = useState("");
  const sel = selRaw || months[0] || "";

  const rows = entries.filter((e) => e.months?.[sel]).map((e) => {
    const ms = e.months![sel];
    return { e, ratio: ms.ratio, chats: ms.chats, commits: ms.commits, cost_krw: ms.cost_krw, plan: ms.plan };
  }).sort((a, b) => b.ratio - a.ratio);


  return (
    <Shell title={t("title.league")}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", zIndex: 1 }}>
        {/* 마스트헤드 */}
        <Section>
          <div className="rise" style={{ paddingTop: 24 }}>
            <div className="kicker" style={{ marginBottom: 14 }}>{t("home.kicker")}</div>
            <h1 className="display" style={{ fontWeight: 600, fontSize: 33, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0 }}>
              {t("home.h1.l1")}<br />{t("home.h1.l2")}<span style={{ color: "var(--accent)" }}>!</span>
            </h1>
            <p style={{ fontSize: 13, color: "var(--text)", margin: "16px 0 18px", lineHeight: 1.6 }}>
              {t("home.lead.a")} {t("home.lead.b1")}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "18px 0 28px" }}>
              <Button variant="dark" shape="pill" onClick={() => router.push("/start")}>{t("home.cta")}</Button>
            </div>
          </div>
        </Section>

        {months.length > 0 && (() => {
          const nowKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
          const isLive = sel === nowKST;
          return (
            <Section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="kicker" style={{ color: "var(--muted)" }}>{t("home.monthRank")}</span>
                  {isLive && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--terra)" }}>
                      <span className="livedot" />{t("home.live")}
                    </span>
                  )}
                </div>
                <Select className="month-select" value={sel} onChange={(v) => v && setSel(v)} accent="var(--terra)" allowClear={false} options={options} />
              </div>
              {isLive && <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 0" }}>{t("home.liveNote")}</p>}
            </Section>
          );
        })()}

        <Section>
          <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" rounded="md" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<span style={{ fontSize: 30 }}>🏆</span>} message={t("home.empty")} />
          ) : (
            <div className="ranklist">
              {rows.map((r, i) => {
                const { tier } = tierForKrw(r.cost_krw);
                const tn = tierName(tier, locale);
                return (
                  <button key={r.e.id} className="rise rankrow" onClick={() => router.push(`/u/${r.e.id}`)}
                    style={{ animationDelay: `${0.03 * i + 0.05}s` }}>
                    {/* 순위 */}
                    <span className="display tnum" style={{ fontSize: 15, fontWeight: 600, color: i < 3 ? "var(--ink)" : "var(--faint)", width: 20, textAlign: "right", flex: "none" }}>{i + 1}</span>
                    {/* 티어 색점 */}
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: tier.color, flex: "none" }} />
                    {/* 닉 + 메타 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="display" style={{ fontWeight: 600, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{r.e.nick}</div>
                      <div className="tnum" style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tn.toLowerCase()} · {won(r.cost_krw)} · ${r.plan}{t("common.perMo")}
                      </div>
                    </div>
                    {/* 배율 + 개인 갱신시각 */}
                    <div style={{ flex: "none", textAlign: "right" }}>
                      <span className="display tnum" style={{ fontWeight: 600, fontSize: 19, color: "var(--sage)", lineHeight: 1 }}>{r.ratio}<span style={{ fontSize: 12, color: "var(--muted)" }}>×</span></span>
                      {r.e.updated && <div className="tnum" style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 3 }}>{fmtKST(r.e.updated)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </Section>

        <div style={{ flex: 1 }} />
        <Section>
          <hr className="hair" style={{ margin: "4px 0 12px" }} />
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, paddingBottom: 4 }}>
            {t("home.footer", { month: options.find((o) => o.value === sel)?.label || "" })}
          </p>
        </Section>
      </div>
    </Shell>
  );
}
