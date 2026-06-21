"use client";
import { useState } from "react";
import { useFetch, Section, SegmentedControl, ListRow, EmptyState, Skeleton, Badge, PoweredByKit, CopyButton } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";

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

  return (
    <Shell title="구독 가성비 랭킹 🏆">
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        {/* 히어로 */}
        <Section>
          <div style={{ background: "linear-gradient(150deg,#2a2622,#3a3028)", borderRadius: 18, padding: "22px 20px", color: "#f4f1ea", marginTop: 6, boxShadow: "0 8px 24px rgba(42,38,34,.15)" }}>
            <div style={{ fontSize: 30, marginBottom: 8, letterSpacing: 2 }}>🏆💸🤑</div>
            <div style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 21, lineHeight: 1.32 }}>
              누가 Claude 구독<br />본전을 제일 뽑나?
            </div>
            <p style={{ fontSize: 13, color: "#cfc8bd", margin: "10px 0 16px", lineHeight: 1.65 }}>
              매달 구독료를 API 정가로 환산하면 몇 배를 뽑는지 겨루는 랭킹.
              Claude Code에서 <b style={{ color: "#e0a060" }}>/usage-rank</b> 한 줄이면 등록돼요.
            </p>
            <CopyButton text="/usage-rank" accent="#d97757" copiedLabel="복사됐어요!">📋 /usage-rank 복사</CopyButton>
          </div>
        </Section>

        {months.length > 0 && (
          <Section>
            <SegmentedControl value={sel} onChange={setSel} accent="#d97757" options={options} />
          </Section>
        )}

        <Section>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" rounded="lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<span style={{ fontSize: 34 }}>🏆</span>} message="아직 기록이 없어요. /usage-rank 로 1등 찜하세요!" />
          ) : (
            rows.map((r, i) => (
              <ListRow
                key={r.e.id}
                accent="#d97757"
                lead={<span style={{ fontSize: i < 3 ? 22 : 16, fontFamily: "Georgia,serif", fontWeight: 800, color: "#9a9389", minWidth: 26, display: "inline-block", textAlign: "center" }}>{i < 3 ? MEDAL[i] : i + 1}</span>}
                title={<span style={{ fontWeight: 700 }}>{r.e.nick} <Badge size="sm">${r.plan}/월</Badge></span>}
                sub={`${won(r.cost_krw)} · 💬 ${r.chats.toLocaleString()} · 🔀 ${r.commits.toLocaleString()}`}
                trailing={<span style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 19, color: "#5fa563" }}>{r.ratio}×</span>}
                onClick={() => router.push(`/u/${r.e.id}`)}
              />
            ))
          )}
        </Section>

        {/* 바닥 고정 푸터 */}
        <div style={{ flex: 1 }} />
        <Section>
          <p style={{ fontSize: 11.5, color: "#9a9389", lineHeight: 1.6, marginTop: 8 }}>
            {options.find((o) => o.value === sel)?.label || ""} 본전배율 순위 · 등록은 <b>/usage-rank</b> · 이름 누르면 상세 리포트 · 금액은 가상 환산값
          </p>
          <div style={{ marginTop: 12, paddingBottom: 4 }}>
            <PoweredByKit slug="clauderank" />
          </div>
        </Section>
      </div>
    </Shell>
  );
}
