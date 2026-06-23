"use client";
import { useState } from "react";
import { useFetch, Section, SegmentedControl, ListRow, EmptyState, Skeleton, Badge, PoweredByKit, CopyButton, Button } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import { tierForKrw, emblemSrc } from "../lib/tier";

type MonthStat = { ratio: number; chats: number; commits: number; cost_krw: number; plan: number };
type Entry = { id: string; nick: string; plan: number; ratio: number; chats: number; commits: number; cost_krw: number; months?: Record<string, MonthStat> };

function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Home() {
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard");
  const router = useRouter();
  const entries = data?.entries ?? [];

  const monthSet = new Set<string>();
  entries.forEach((e) => Object.keys(e.months || {}).forEach((m) => monthSet.add(m)));
  const months = [...monthSet].sort().reverse();
  const options = months.map((m) => ({ value: m, label: `${m.split("-")[0].slice(2)}.${+m.split("-")[1]}월` }));
  const [selRaw, setSel] = useState("");
  const sel = selRaw || months[0] || "";

  const rows = entries.filter((e) => e.months?.[sel]).map((e) => {
    const ms = e.months![sel];
    return { e, ratio: ms.ratio, chats: ms.chats, commits: ms.commits, cost_krw: ms.cost_krw, plan: ms.plan };
  }).sort((a, b) => b.ratio - a.ratio);
  const top = rows[0];

  return (
    <Shell title="THE LEAGUE">
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", zIndex: 1 }}>
        {/* 마스트헤드 */}
        <Section>
          <div className="rise" style={{ paddingTop: 22 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>구독 가성비 리그 · CLAUDE</div>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
              누가 본전을<br />제일 뽑나<span style={{ color: "var(--terra)" }}>?</span>
            </h1>
            {top && (() => {
              const { tier } = tierForKrw(top.cost_krw);
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "16px 0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={emblemSrc(tier.key)} alt={tier.ko} style={{ width: 46, height: 46, objectFit: "contain", filter: "drop-shadow(0 2px 5px rgba(0,0,0,.25))" }} />
                    <div>
                      <div className="kicker" style={{ color: "var(--muted)", fontSize: 10, marginBottom: 2 }}>현재 선두 · <span style={{ color: tier.color }}>{tier.ko}</span></div>
                      <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>{top.e.nick}</div>
                    </div>
                  </div>
                  <div className="display tnum" style={{ fontSize: 52, fontWeight: 900, color: "var(--terra)", lineHeight: .82, letterSpacing: "-0.03em" }}>
                    {top.ratio}<span style={{ fontSize: 26 }}>×</span>
                  </div>
                </div>
              );
            })()}
            <p style={{ fontSize: 12.5, color: "#7a7064", margin: "14px 0 12px", lineHeight: 1.6 }}>
              매달 구독료를 API 정가로 환산하면 몇 배를 뽑는지 겨루는 랭킹.
              Claude Code에서 <b className="display" style={{ color: "var(--terra-deep)" }}>/usage-rank</b> 한 줄이면 등록돼요.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="dark" shape="pill" onClick={() => router.push("/start")}>나도 등록하기 →</Button>
              <CopyButton text="/usage-rank" accent="var(--terra)" copiedLabel="복사됐어요!">/usage-rank 복사</CopyButton>
            </div>
            <hr className="hair" style={{ marginTop: 18 }} />
          </div>
        </Section>

        {months.length > 0 && (() => {
          const nowKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
          const isLive = sel === nowKST;
          return (
            <Section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="kicker" style={{ color: "var(--muted)" }}>월별 순위</span>
                {isLive && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--terra)" }}>
                    <span className="livedot" />LIVE · 진행 중
                  </span>
                )}
              </div>
              <SegmentedControl value={sel} onChange={setSel} accent="var(--terra)" options={options} />
              {isLive && <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 0" }}>이번 달은 진행 중 — <b className="display">/usage-rank</b> 로 언제든 역전 가능 🏃</p>}
            </Section>
          );
        })()}

        <Section>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" rounded="lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<span style={{ fontSize: 34 }}>🏆</span>} message="아직 기록이 없어요. /usage-rank 로 1등 찜하세요!" />
          ) : (
            rows.map((r, i) => {
              const { tier } = tierForKrw(r.cost_krw);
              return (
                <div key={r.e.id} className="rise" style={{ animationDelay: `${0.04 * i + 0.08}s`, marginBottom: 10 }}>
                  <ListRow
                    accent={tier.color}
                    lead={<span className="display tnum" style={{ fontSize: i < 3 ? 22 : 17, fontWeight: 900, color: i < 3 ? "var(--ink)" : "var(--muted)", minWidth: 28, display: "inline-block", textAlign: "center" }}>{i < 3 ? MEDAL[i] : i + 1}</span>}
                    title={<span className="display" style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", fontWeight: 700, fontSize: 16 }}>
                      <img src={emblemSrc(tier.key)} alt={tier.ko} title={tier.ko} style={{ width: 30, height: 30, objectFit: "contain", flex: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.2))" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.e.nick}</span>
                      <Badge size="sm">${r.plan}/월</Badge>
                      <span className="tnum" style={{ marginLeft: "auto", fontWeight: 900, fontSize: 21, color: "var(--sage)", flex: "none" }}>{r.ratio}<span style={{ fontSize: 13 }}>×</span></span>
                    </span>}
                    sub={<span className="tnum" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className="display" style={{ background: tier.color, color: "#fff", padding: "1px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: ".02em" }}>{tier.ko}</span>
                      <span style={{ color: "var(--muted)" }}>{won(r.cost_krw)} · 💬 {r.chats.toLocaleString()} · 🔀 {r.commits.toLocaleString()}</span>
                    </span>}
                    onClick={() => router.push(`/u/${r.e.id}`)}
                  />
                </div>
              );
            })
          )}
        </Section>

        <div style={{ flex: 1 }} />
        <Section>
          <hr className="hair" style={{ margin: "4px 0 12px" }} />
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
            {options.find((o) => o.value === sel)?.label || ""} 본전배율 순위 · 등록은 <b className="display">/usage-rank</b> 명령으로만 · 이름을 누르면 상세 리포트 · 금액은 가상 환산값
          </p>
          <div style={{ marginTop: 12, paddingBottom: 4 }}>
            <PoweredByKit slug="clauderank" />
          </div>
        </Section>
      </div>
    </Shell>
  );
}
